import { SlashCommandBuilder } from '@discordjs/builders';
import type { CommandInteraction } from 'discord.js';
import type Command from "../interfaces/Command"

const data = new SlashCommandBuilder()
	.setName('ping')
	.setDescription('Replies with Pong!');

async function execute(interaction: CommandInteraction): Promise<void> {
	const latency = Date.now() - interaction.createdTimestamp;
	await interaction.reply(`Pong in ${latency} ms!`);
}

export default {
	data,
	execute
} as Command