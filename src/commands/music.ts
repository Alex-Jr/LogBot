import 'dotenv/config'
import { SlashCommandBuilder } from '@discordjs/builders';
import { AudioPlayerStatus, AudioResource, entersState, joinVoiceChannel, VoiceConnectionStatus } from '@discordjs/voice';
import { GuildMember, Snowflake } from 'discord.js';
import type { CommandInteraction } from 'discord.js';
import type Command from "../interfaces/Command"
import MusicSubscription from '../classes/MusicSubscription';
import Track from '../classes/Track';

const subscriptions = new Map<Snowflake, MusicSubscription>();

const data = new SlashCommandBuilder()
	.setName('music')
	.setDescription('Play youtube music and playlists!')
  .addSubcommand(subcommand => 
    subcommand
      .setName('play')
      .setDescription('Play a music')
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
      .setDescription('Skip a music')  
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('queue')
      .setDescription('Show musics in queue')  
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('pause')
      .setDescription('Pause player')  
  )
  .addSubcommand(subcommand => 
    subcommand
    .setName('resume')
    .setDescription('Resume player')
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('leave')
      .setDescription('Leave')  
  );

async function play(interaction: CommandInteraction, subscription: MusicSubscription | undefined) {
  // Extract the video URL from the command
  const url = interaction.options.get('song')!.value! as string;

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
    await interaction.followUp('Join a voice channel and then try that again!');
    return;
  }

  // Make sure the connection is ready before processing the user's request
  try {
    await entersState(subscription.voiceConnection, VoiceConnectionStatus.Ready, 20e3);
  } catch (error) {
    console.warn(error);
    await interaction.followUp('Failed to join voice channel within 20 seconds, please try again later!');
    return;
  }

  try {
    // Attempt to create a Track from the user's video URL
    const track = await Track.from(url, {
      onStart() {
        interaction.followUp({ content: 'Now playing!' }).catch(console.warn);
      },
      onFinish() {
        interaction.followUp({ content: 'Now finished!' }).catch(console.warn);
      },
      onError(error) {
        console.warn(error);
        interaction.followUp({ content: `Error: ${error.message}`, ephemeral: true }).catch(console.warn);
      },
    });
    // Enqueue the track and reply a success message to the user
    subscription.enqueue(track);
    await interaction.followUp(`Enqueued **${track.title}**`);
  } catch (error) {
    console.warn(error);
    await interaction.editReply('Failed to play track, please try again later!');
  }
} 

async function skip(interaction: CommandInteraction, subscription: MusicSubscription | undefined) {
  if (subscription) {
    // Calling .stop() on an AudioPlayer causes it to transition into the Idle state. Because of a state transition
    // listener defined in music/subscription.ts, transitions into the Idle state mean the next track from the queue
    // will be loaded and played.
    subscription.audioPlayer.stop();
    await interaction.editReply('Skipped song!');
  } else {
    await interaction.editReply('Not playing in this server!');
  }
}

async function queue(interaction: CommandInteraction, subscription: MusicSubscription | undefined) {
  // Print out the current queue, including up to the next 5 tracks to be played.
  if (subscription) {
    const current =
      subscription.audioPlayer.state.status === AudioPlayerStatus.Idle
        ? `Nothing is currently playing!`
        : `Playing **${(subscription.audioPlayer.state.resource as AudioResource<Track>).metadata.title}**`;

    const queue = subscription.queue
      .slice(0, 5)
      .map((track, index) => `${index + 1}) ${track.title}`)
      .join('\n');

    await interaction.editReply(`${current}\n\n${queue}`);
  } else {
    await interaction.editReply('Not playing in this server!');
  }
}

async function pause(interaction: CommandInteraction, subscription: MusicSubscription | undefined) {
  if (subscription) {
    subscription.audioPlayer.pause();
    await interaction.editReply({ content: `Paused!` });
  } else {
    await interaction.editReply('Not playing in this server!');
  }
}

async function resume(interaction: CommandInteraction, subscription: MusicSubscription | undefined) {
  if (subscription) {
    subscription.audioPlayer.unpause();
    await interaction.editReply({ content: `Unpaused!` });
  } else {
    await interaction.editReply('Not playing in this server!');
  }
}

async function leave(interaction: CommandInteraction, subscription: MusicSubscription | undefined) {
  if (subscription) {
    subscription.voiceConnection.destroy();
    subscriptions.delete(interaction.guildId!);
    await interaction.editReply({ content: `Left channel!` });
  } else {
    await interaction.editReply('Not playing in this server!');
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
      await interaction.editReply('Unknown command');
      break;
  }

  // await interaction.reply('Ok!')
}

export default {
	data,
	execute
} as Command