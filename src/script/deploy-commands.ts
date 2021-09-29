import 'dotenv/config'
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import commands from '../commands/index';

// Place your client and guild ids here
const clientId = '581844036092952586';
const guildId = '884248430854148146';

const rest = new REST({ version: '9' }).setToken(process.env.TOKEN || '');

const commandsArray = Array.from(commands.values()).map((c) => c.data.toJSON());

(async () => {
	try {
		console.log('Started refreshing application (/) commands.');

		await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commandsArray },
		);

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}
})()