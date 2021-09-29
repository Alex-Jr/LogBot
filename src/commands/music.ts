import 'dotenv/config'
import { SlashCommandBuilder } from '@discordjs/builders';
import { joinVoiceChannel } from '@discordjs/voice';
import { GuildMember, Message } from 'discord.js';
import type { CommandInteraction } from 'discord.js';
import type Command from "../interfaces/Command"
import { default as ytsearch } from 'youtube-search';


const data = new SlashCommandBuilder()
	.setName('music')
	.setDescription('Play youtube music and playlists!')
  .addSubcommand(subcommand => 
    subcommand
      .setName('queue')
      .setDescription('Enqueue a music')
      .addStringOption((option) => 
        option
          .setName('name')
          .setDescription('Music name')
          .setRequired(true)
      )
  )

async function searchMusic(name: string) {
  const query = await ytsearch(name, {
    key: process.env.YTKEY,
    maxResults: 5,
  })

  return query.results
}

async function queue(interaction: CommandInteraction): Promise<void> {
  const musicName = interaction.options.getString('name')

  if(!musicName) return;

  const results = await searchMusic(musicName);

  let msg = '';

  results.forEach((result, index) => {
    msg += `${index + 1}° - ${result.title}\n`
  })

  const message = await interaction.editReply(msg);
  if(!(message instanceof Message)) return;

  const reactions = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣']


  for(const reaction of reactions) {
    await message.react(reaction);
  }

  function filter (reaction: any, user: any) {
    console.log(reaction);
    return reactions.includes(reaction.emoji.name) && user.id === interaction.user.id;
  }
  
  try {
    const collected = await message.awaitReactions({ filter, max: 1, time: 20000, errors: ['time'] })

    const reactionSelected = collected.first();
    
    const index = reactions.findIndex((reaction) => reaction === reactionSelected?.emoji.name);
    await message.edit(`Escolhida: ${results[index].title}`);
  } catch (err) {
    await message.react('Nenhuma resposta...')
  }
}



async function execute(interaction: CommandInteraction): Promise<void> {
	if(!interaction.member || !(interaction.member instanceof GuildMember)) return;

  const channel = interaction.member.voice.channel
  if(!channel) return interaction.reply('Você não está em um canal de voz');

  joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator
  })

  await interaction.deferReply();

  switch(interaction.options.getSubcommand()) {
    case 'queue': 
      await queue(interaction);
      break;
    default:
      break;
  }

  // await interaction.reply('Ok!')
}

export default {
	data,
	execute
} as Command