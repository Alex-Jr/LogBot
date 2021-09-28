import http from 'http';
import Prometheus from 'prom-client';

export const commands_received = new Prometheus.Counter({
  name: 'discord_commands_received_total',
  help: 'Counter for all commands received',
  labelNames: ['command']
})

export const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', Prometheus.register.contentType);
    res.end(await Prometheus.register.metrics())
})