import type Command from "../interfaces/Command"
import { default as Ping } from './ping'
import { default as Avatar } from './avatar';
import { default as Info } from './info';
import { default as Music } from './music';
import { default as Prune } from './prune';

const commands: Map<string, Command> = new Map()

commands.set(Ping.data.name, Ping)
commands.set(Avatar.data.name, Avatar)
commands.set(Info.data.name, Info)
commands.set(Music.data.name, Music)
commands.set(Prune.data.name, Prune)

export default commands