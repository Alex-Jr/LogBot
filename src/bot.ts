import 'dotenv/config'
import { Client, Intents } from 'discord.js';
import http from 'http';
import Prometheus from 'prom-client';

const messages_received = new Prometheus.Counter({
  name: 'messages_received',
  help: 'Counter for messages received'
})

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

client.on('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});

client.on('messageCreate', async message => {
  console.log(message)

  messages_received.inc(1)
});

client.login(process.env.TOKEN);


const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', Prometheus.register.contentType);
  res.end(await Prometheus.register.metrics())
})

server.listen(9000)