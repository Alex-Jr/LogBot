import 'dotenv'
import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, GuildMember, TextChannel } from 'discord.js';
import type Command from "../interfaces/Command"

const data = new SlashCommandBuilder()
    .setName('prune')
    .setDescription('Apaga até 99 messagens.')
    .addIntegerOption((option) => 
        option
            .setName('amount')
            .setDescription('Quantidade de mensagems para apagar')
            .setRequired(true)
    );

async function execute(interaction: CommandInteraction): Promise<void> {
    if (!(interaction.guild?.members.cache.get(process.env.CLIENT_ID!)?.permissions.has('MANAGE_MESSAGES'))) {
        interaction.reply('Eu não tenho permissão para isso')
        return
    }

    if (!(interaction.member instanceof GuildMember)) { return }
    if (!(interaction.channel instanceof TextChannel)) { return }

    if (!interaction.member.permissions.has('MANAGE_MESSAGES')) {
        interaction.reply('Você não tem permissão para isso')
        return
    }

    // setRequired is true
	const amount = interaction.options.getInteger('amount')!;

    if (amount <= 1 || amount > 100) {
        interaction.reply({ content: 'Precisa ser um valor entre 1 e 99', ephemeral: true });
        return
    }
    
    await interaction.channel.bulkDelete(amount, true)

    await interaction.reply({ content: `Apaguei \`${amount}\` mensagens.`, ephemeral: true });
}

export default {
	data,
	execute
} as Command