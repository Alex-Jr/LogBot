import { SlashCommandBuilder } from '@discordjs/builders';
import type { CommandInteraction } from 'discord.js';
import type Command from "../interfaces/Command"

const data = new SlashCommandBuilder()
	.setName('avatar')
	.setDescription('Get the avatar URL of selected user, or your own avatar.')
    .addUserOption((option) => {
        return option
            .setName('target')
            .setDescription('The target user to show the avatar')
            .setRequired(false)
    });

async function execute(interaction: CommandInteraction): Promise<void> {
    const target = interaction.options.getUser('target') || interaction.user;

	await interaction.reply(target.displayAvatarURL({dynamic: true}));
}

export default {
	data,
	execute
} as Command