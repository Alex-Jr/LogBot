import 'dotenv/config'
import { Client, Intents } from 'discord.js';
import { commands_received } from './prometheus';

export const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

client.on('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});

client.on('messageCreate', async (message) => {

  commands_received.inc(1)
});