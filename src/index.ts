import 'dotenv/config'
import { client } from './bot';
import { server } from './prometheus'

server.listen(9000)
client.login(process.env.TOKEN);