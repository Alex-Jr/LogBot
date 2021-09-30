import 'dotenv/config'
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import commands from '../commands/index';
import sleep from '../utils/sleep';

// Place your client and guild ids here
const clientId = '581844036092952586';
const guildId = '884248430854148146';

const rest = new REST({ version: '9' }).setToken(process.env.TOKEN || '');

const commandsArray = Array.from(commands.values()).map((c) => c.data.toJSON());

interface commands {
    id: string,
    application_id: string,
    guild_id: string
}

(async () => {
	try {
		console.log('Started fetching application (/) commands.');

		const commands = await rest.get(
			Routes.applicationGuildCommands(clientId, guildId),
		) as commands[];

       
        for(const command of commands) {
            await rest.delete(
                Routes.applicationGuildCommand(command.application_id, command.guild_id, command.id)
            )

            await sleep(1000)
        }


		console.log('Successfully deleted application (/) commands.');
	} catch (error) {
		console.error(error);
	}
})()