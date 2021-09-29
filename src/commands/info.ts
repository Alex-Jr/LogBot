import { SlashCommandBuilder } from '@discordjs/builders';
import type { CommandInteraction } from 'discord.js';
import type Command from "../interfaces/Command"

const data = new SlashCommandBuilder()
    .setName('info')
    .setDescription('Get info about a user or a server!')
    .addSubcommand(subcommand =>
        subcommand
            .setName('user')
            .setDescription('Info about a user')
            .addUserOption(option => option.setName('target').setDescription('The user')))
    .addSubcommand(subcommand =>
        subcommand
            .setName('server')
            .setDescription('Info about the server'));


async function user(interaction: CommandInteraction): Promise<void> {
    const user = interaction.options.getUser('target');

    if(!user) return;

    await interaction.reply(`Username: ${user.username}\nID: ${user.id}\nCreation: ${user.createdAt}`);
}

async function server(interaction: CommandInteraction): Promise<void> {
    const guild = interaction.guild;

    if(!guild) return;

    await interaction.reply(`Server name: ${guild.name}\nTotal members: ${guild.memberCount}\nCreation: ${guild.createdAt}`);
}

async function execute(interaction: CommandInteraction): Promise<void> {
    switch(interaction.options.getSubcommand()) {
        case 'user':
            await user(interaction);
            break;
        case 'server':
            await server(interaction);
            break;
        default:
            await interaction.reply(`Ops, não sei nada sobre isso.`);
    }
}

export default {
	data,
	execute
} as Command