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
import { default as getPlaylistInfo } from 'ytpl';
import { getInfo as getSongInfo } from 'ytdl-core';
import sleep from '../utils/sleep';

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

interface SongInfo {
  url: string,
  title?: string
}

const subscriptions = new Map<Snowflake, MusicSubscription>();

const reactions = ['1️⃣', '2️⃣', '3️⃣', '🇽']

async function handleTracks(songInfo: SongInfo, subscription: MusicSubscription, interaction: CommandInteraction): Promise<string> {
  async function addTrack(song: string, title: string) {
    const track = await Track.from(song, {
      onStart() {
        subscription.textChannel.send(`Tocando... ${ title }`).catch(console.warn);
      },
      onFinish() {
        // interaction.followUp({ content: 'Acabou!' }).catch(console.warn);
        musics_played.inc();
      },
      onError(error) {
        console.warn(error);
        subscription.textChannel.send('Hmmmm, algo deu ruim!').catch(console.warn);
      },
    });
    // Enqueue the track and reply a success message to the user
    subscription.enqueue(track);
  }

  const songs = [] as { url: string, title: string }[]

  let response = '';
  if(songInfo.url.indexOf('playlist') !== -1) {
    const result = await getPlaylistInfo(songInfo.url, { limit: 20 })

    result.items.forEach(item => {
      songs.push({ url: item.shortUrl, title: item.title })
    });
    response = `Playlist: ${result.title}`
  } else {
    const result = await getSongInfo(songInfo.url)
  
    songs.push({ url: songInfo.url, title: result.videoDetails.title })
    response = `Música: ${result.videoDetails.title}`
  }

  for(const song of songs) {
    await addTrack(song.url, song.title)
    await sleep(1000)
  }
  // Attempt to create a Track from the user's video URL
  
  return response
}

async function handleSongInput(interaction: CommandInteraction, song: string): Promise<SongInfo | undefined> {
  function filter (reaction: any, user: any) {
    return reactions.includes(reaction.emoji.name) && user.id === interaction.user.id;
  }

  try {
    // Check if song is already a URL
    new URL(song)
    return { url: song }
  } catch (_) {
    const results = await searchMusic(song);
  
    let msg = 'Músicas:\n';
    
    results.forEach((result, index) => {
      msg += `${index + 1}° - ${result.title}\n`
    })
  
    const message = await interaction.editReply(msg) as Message;
  
    for(const reaction of reactions) {
      message.react(reaction);
    }
      
    let index = 0;
  
    try {
      const collected = await message.awaitReactions({ filter, max: 1, time: 20000, errors: ['time'] })
  
      const reactionSelected = collected.first();
      
      index = reactions.findIndex((reaction) => reaction === reactionSelected?.emoji.name);

      if(index === 3) return undefined

      return { url: results[index].link, title: results[index].title }
    } catch (err) {
      return undefined;
    }
  }
}
async function play(interaction: CommandInteraction, subscription: MusicSubscription | undefined) {
  // Extract the video URL from the command
  const song = interaction.options.getString('song')!

  const songInfo = await handleSongInput(interaction, song)

  if(!songInfo) {
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
        interaction.channel!
      );
      subscription.voiceConnection.on('error', console.warn);
      subscriptions.set(interaction.guildId!, subscription);
    }
  }

  // If there is no subscription, tell the user they need to join a channel.
  if (!subscription) {
    await interaction.editReply('Você não está em um canal de voz!');
    return;
  }

  // Make sure the connection is ready before processing the user's request
  try {
    await entersState(subscription.voiceConnection, VoiceConnectionStatus.Ready, 20e3);
  } catch (error) {
    console.warn(error);
    await interaction.editReply('Hmmm, não consegui entrar no canal de voz');
    return;
  }

  try {
    const response = await handleTracks(songInfo, subscription, interaction)
    
    await interaction.editReply(response);
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
      .slice(0, 10)
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

  let subscription = subscriptions.get(interaction.guildId);
  
  if(subscription?.destroyed) {
    subscription = undefined // Make sure to create a new one
  }

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