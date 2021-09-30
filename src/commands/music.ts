import 'dotenv/config'
import { SlashCommandBuilder } from '@discordjs/builders';
import { AudioPlayerStatus, AudioResource, entersState, joinVoiceChannel, VoiceConnectionStatus } from '@discordjs/voice';
import { GuildMember, Snowflake } from 'discord.js';
import type { CommandInteraction, Message } from 'discord.js';
import type Command from "../interfaces/Command"
import MusicSubscription from '../classes/MusicSubscription';
import Track from '../classes/Track';
import searchMusic from '../utils/queryMusic';
import { musics_played } from '../prometheus';
import ytpl from 'ytpl';
import sleep from '../utils/sleep';

const subscriptions = new Map<Snowflake, MusicSubscription>();

const data = new SlashCommandBuilder()
	.setName('music')
	.setDescription('Play youtube music and playlists!')
  .addSubcommand(subcommand => 
    subcommand
      .setName('play')
      .setDescription('Toca uma música')
      .addStringOption((option) => 
        option
          .setName('song')
          .setDescription('Music name')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('skip')
      .setDescription('Pula uma música')  
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('queue')
      .setDescription('Mostra músicas na fila')  
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('pause')
      .setDescription('Pausa a música')  
  )
  .addSubcommand(subcommand => 
    subcommand
    .setName('resume')
    .setDescription('Retorna a música')
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('leave')
      .setDescription('Para as músicas')  
  );

const reactions = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣']

async function handleTracks(url: string, subscription: MusicSubscription, interaction: CommandInteraction): Promise<string> {
  async function addTrack(song: string) {
    const track = await Track.from(song, {
      onStart() {
        interaction.followUp({ content: 'Tocando...' }).catch(console.warn);
      },
      onFinish() {
        interaction.followUp({ content: 'Acabou!' }).catch(console.warn);
        musics_played.inc();
      },
      onError(error) {
        console.warn(error);
        interaction.followUp({ content: 'Hmmmm, algo deu ruim!' }).catch(console.warn);
      },
    });
    // Enqueue the track and reply a success message to the user
    subscription.enqueue(track);
  }

  const songs = [] as string[]

  let response = '';
  if(url.indexOf('playlist')) {
    const result = await ytpl(url, { limit: 20 })
    result.items.forEach(item => {
      console.log(item)
      songs.push(item.url)
    });
    response = `Playlist: ${result.title}`
  } else {
    songs.push(url)
    response = `Música adicionada!`
  }

  for(const song of songs) {
    await addTrack(song)
    await sleep(1000)
  }
  // Attempt to create a Track from the user's video URL
  
  return response
}

async function handleSongInput(interaction: CommandInteraction, song: string): Promise<string | undefined> {
  function filter (reaction: any, user: any) {
    return reactions.includes(reaction.emoji.name) && user.id === interaction.user.id;
  }

  try {
    new URL(song)
    return song
  } catch (_) {
    const results = await searchMusic(song);
  
    let msg = 'Músicas:\n';
    
    results.forEach((result, index) => {
      msg += `${index + 1}° - ${result.title}\n`
    })
  
    const message = await interaction.editReply(msg) as Message;
  
    for(const reaction of reactions) {
      await message.react(reaction);
    }
      
    let index = 0;
  
    try {
      const collected = await message.awaitReactions({ filter, max: 1, time: 20000, errors: ['time'] })
  
      const reactionSelected = collected.first();
      
      index = reactions.findIndex((reaction) => reaction === reactionSelected?.emoji.name);
      await message.edit(`Escolhida: ${results[index].title}`);

      return results[index].link
    } catch (err) {
      return undefined;
    }
  }
}
async function play(interaction: CommandInteraction, subscription: MusicSubscription | undefined) {
  // Extract the video URL from the command
  const song = interaction.options.getString('song')!

  const url = await handleSongInput(interaction, song)

  if(!url) {
    await interaction.editReply('Não encontrei sua música')
    return
  }

  // If a connection to the guild doesn't already exist and the user is in a voice channel, join that channel
  // and create a subscription.
  if (!subscription) {
    if (interaction.member instanceof GuildMember && interaction.member.voice.channel) {
      const channel = interaction.member.voice.channel;
      subscription = new MusicSubscription(
        joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator,
        }),
      );
      subscription.voiceConnection.on('error', console.warn);
      subscriptions.set(interaction.guildId!, subscription);
    }
  }

  // If there is no subscription, tell the user they need to join a channel.
  if (!subscription) {
    await interaction.followUp('Você não está em um canal de voz!');
    return;
  }

  // Make sure the connection is ready before processing the user's request
  try {
    await entersState(subscription.voiceConnection, VoiceConnectionStatus.Ready, 20e3);
  } catch (error) {
    console.warn(error);
    await interaction.followUp('Hmmm, não consegui entrar no canal de voz');
    return;
  }

  try {
    const response = await handleTracks(url, subscription, interaction)
    
    await interaction.followUp(response);
  } catch (error) {
    console.warn(error);
    await interaction.editReply('Ops, algo de errado não está certo!');
  }
} 

async function skip(interaction: CommandInteraction, subscription: MusicSubscription | undefined) {
  if (subscription) {
    // Calling .stop() on an AudioPlayer causes it to transition into the Idle state. Because of a state transition
    // listener defined in music/subscription.ts, transitions into the Idle state mean the next track from the queue
    // will be loaded and played.
    subscription.audioPlayer.stop();
    await interaction.editReply('Passando!');
  } else {
    await interaction.editReply('Nada está tocando!');
  }
}

async function queue(interaction: CommandInteraction, subscription: MusicSubscription | undefined) {
  // Print out the current queue, including up to the next 5 tracks to be played.
  if (subscription) {
    const current =
      subscription.audioPlayer.state.status === AudioPlayerStatus.Idle
        ? `Nada na fila!`
        : `Tocando **${(subscription.audioPlayer.state.resource as AudioResource<Track>).metadata.title}**`;

    const queue = subscription.queue
      .slice(0, 5)
      .map((track, index) => `${index + 1}) ${track.title}`)
      .join('\n');

    await interaction.editReply(`${current}\n\n${queue}`);
  } else {
    await interaction.editReply('Nada está tocando!');
  }
}

async function pause(interaction: CommandInteraction, subscription: MusicSubscription | undefined) {
  if (subscription) {
    subscription.audioPlayer.pause();
    await interaction.editReply({ content: `Esperando...` });
  } else {
    await interaction.editReply('Nada está tocando!');
  }
}

async function resume(interaction: CommandInteraction, subscription: MusicSubscription | undefined) {
  if (subscription) {
    subscription.audioPlayer.unpause();
    await interaction.editReply({ content: `Voltei!` });
  } else {
    await interaction.editReply('Nada está tocando!');
  }
}

async function leave(interaction: CommandInteraction, subscription: MusicSubscription | undefined) {
  if (subscription) {
    subscription.voiceConnection.destroy();
    subscriptions.delete(interaction.guildId!);
    await interaction.editReply({ content: `Até logo!` });
  } else {
    await interaction.editReply('Nada está tocando!');
  }
}

async function execute(interaction: CommandInteraction): Promise<void> {
  if(!interaction.guildId) return

  const subscription = subscriptions.get(interaction.guildId);

  await interaction.deferReply();

  switch(interaction.options.getSubcommand()) {
    case 'play': 
      await play(interaction, subscription);
      break;
    case 'skip':
      await skip(interaction, subscription);
      break;
    case 'queue':
      await queue(interaction, subscription);
      break;
    case 'pause':
      await pause(interaction, subscription)
      break
    case 'resume':
      await resume(interaction, subscription)
      break;
    case 'leave':
      await leave(interaction, subscription)
      break;
    default:
      await interaction.editReply('Não conheço essa!');
      break;
  }

  // await interaction.reply('Ok!')
}

export default {
	data,
	execute
} as Command