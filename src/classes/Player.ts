import { createAudioPlayer, VoiceConnectionStatus, AudioPlayerStatus } from '@discordjs/voice/'
import type { AudioPlayer, VoiceConnection } from "@discordjs/voice";
import Track from "./Track";

class Player {
    public readonly voiceConnection: VoiceConnection;
	public readonly audioPlayer: AudioPlayer;
	public queue: Track[];

    constructor(voiceConnection: VoiceConnection) {
        this.voiceConnection = voiceConnection;
        this.audioPlayer = createAudioPlayer();
        this.queue = [];

    //     this.voiceConnection.on(VoiceConnectionStatus.Ready, (oldState, newState) => {
    //         console.log(oldState)
    //     });


    //     this.audioPlayer.on(AudioPlayerStatus.Playing, (_oldState, _newState) => {
    //         console.log(oldState)
    //     });
    // }
}