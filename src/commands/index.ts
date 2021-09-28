import type Command from "../interfaces/Command"
import { default as Ping } from './ping'

const commands: Map<string, Command> = new Map()

commands.set(Ping.data.name, Ping)

export default commands