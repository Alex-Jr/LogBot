import { SlashCommandBuilder } from '@discordjs/builders';
import type { CommandInteraction } from 'discord.js';
import type Command from "../interfaces/Command"

const data = new SlashCommandBuilder()
    .setName('info')
    .setDescription('Retorna informações sobre o usuário ou servidor!')
    .addSubcommand(subcommand =>
        subcommand
            .setName('user')
            .setDescription('Informações do usuário')
            .addUserOption(option => option.setName('target').setDescription('Usuário alvo')))
    .addSubcommand(subcommand =>
        subcommand
            .setName('server')
            .setDescription('Informações do servidor'));


async function user(interaction: CommandInteraction): Promise<void> {
    const user = interaction.options.getUser('target');

    if(!user) return;

    await interaction.reply(`Usuário: ${user.username}\nID: ${user.id}\nData Criação: ${user.createdAt}`);
}

async function server(interaction: CommandInteraction): Promise<void> {
    const guild = interaction.guild; 

    if(!guild) return;

    await interaction.reply(`Servidor: ${guild.name}\nN° membros: ${guild.memberCount}\nData Criação: ${guild.createdAt}`);
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
            await interaction.reply(`Ops, comando desconhecido.`);
    }
}

export default {
	data,
	execute
} as Command