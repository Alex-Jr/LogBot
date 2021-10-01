import { Client, Intents } from 'discord.js';
import { commands_received } from './prometheus';
import commands from './commands'

export const client = new Client({ intents: [ Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS ] });

client.on('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});

client.on('interactionCreate', async (interaction) => {
	if (!interaction.isCommand()) return;

	const command = commands.get(interaction.commandName);

	if (!command) {
		interaction.reply('Hmmm, não conheço essa.');
		return
	}

	
	try {
		console.log(`${command.data.name} invocado por ${interaction.user.tag}`)
		await command.execute(interaction)

		commands_received.inc(1)
	} catch (error) {
		console.error(error);
		return interaction.reply('Ops, escorreguei em uns bits!');
	}
});