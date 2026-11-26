import {Sound} from "phaser";

/**
 * Shared WebAudio routing for the synthesized sounds and the music, one per page.
 *
 * Sound effects go through Phaser's master output: the global mute and the effects volume
 * (Phaser's master volume) apply to them like to the sample files.
 * The music has its own volume, so it goes straight to the speakers and follows the global mute by hand.
 * Both share a hall reverb and a compressor that glues the layers together.
 */
export default class AudioBus {
    private static _instance: AudioBus | null = null;

    private static readonly REVERB_SECONDS: number = 1.8;
    private static readonly REVERB_DECAY: number = 2.8;

    public readonly context: AudioContext;
    /** Dry effects */
    public readonly sfx: AudioNode;
    /** Effects reverb send */
    public readonly sfxReverb: AudioNode;
    /** Dry music, after its volume */
    public readonly music: AudioNode;
    /** Music reverb send */
    public readonly musicReverb: AudioNode;

    private readonly _musicVolume: GainNode;
    private _noise: AudioBuffer | null = null;
    private _musicLevel: number = 0.7;
    private _muted: boolean = false;

    /** Null when the browser has no WebAudio */
    public static get(sound: Sound.BaseSoundManager): AudioBus | null {
        if (AudioBus._instance)
            return AudioBus._instance;
        if (!(sound instanceof Sound.WebAudioSoundManager))
            return null;

        AudioBus._instance = new AudioBus(sound);
        return AudioBus._instance;
    }

    private constructor(sound: Sound.WebAudioSoundManager) {
        const context = sound.context;
        this.context = context;

        // Effects: compressor so stacked explosions don't clip, then Phaser's mute and volume
        const sfxCompressor = context.createDynamicsCompressor();
        sfxCompressor.threshold.value = -14;
        sfxCompressor.ratio.value = 4;
        sfxCompressor.connect(sound.destination);
        this.sfx = sfxCompressor;

        // Music: its own volume and compressor, straight to the speakers
        this._musicVolume = context.createGain();
        this._musicVolume.connect(context.destination);
        const musicCompressor = context.createDynamicsCompressor();
        musicCompressor.threshold.value = -18;
        musicCompressor.ratio.value = 3;
        musicCompressor.connect(this._musicVolume);
        this.music = musicCompressor;

        // A single convolution reverb, the costliest node, for the music; the effects get a light echo instead
        this.musicReverb = this.createReverb(this.createImpulse(), musicCompressor, 0.9);
        this.sfxReverb = this.createEcho(sfxCompressor);

        this._muted = sound.mute;
        sound.on(Sound.Events.GLOBAL_MUTE, (_manager: unknown, muted: boolean) => {
            this._muted = muted;
            this.applyMusicVolume();
        });
        this.applyMusicVolume();
    }

    /** @param level 0..1 */
    public setMusicVolume(level: number) {
        this._musicLevel = level;
        this.applyMusicVolume();
    }

    /** Lowers the music for a while, e.g. under the pause menu */
    public duckMusic(ducked: boolean) {
        const target = this._muted ? 0 : this._musicLevel * (ducked ? 0.35 : 1);
        this._musicVolume.gain.setTargetAtTime(target, this.context.currentTime, 0.15);
    }

    /** One second of white noise, shared by every noisy sound */
    public get noise(): AudioBuffer {
        if (!this._noise) {
            this._noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
            const samples = this._noise.getChannelData(0);
            for (let i = 0; i < samples.length; i++)
                samples[i] = Math.random() * 2 - 1;
        }
        return this._noise;
    }

    private applyMusicVolume() {
        this._musicVolume.gain.setTargetAtTime(this._muted ? 0 : this._musicLevel, this.context.currentTime, 0.05);
    }

    private createReverb(impulse: AudioBuffer, output: AudioNode, level: number): AudioNode {
        const convolver = this.context.createConvolver();
        convolver.buffer = impulse;
        const gain = this.context.createGain();
        gain.gain.value = level;
        convolver.connect(gain).connect(output);
        return convolver;
    }

    /** Two quick fading repeats, darker each time: a sense of space for almost no processing */
    private createEcho(output: AudioNode): AudioNode {
        const input = this.context.createGain();
        const delay = this.context.createDelay(1);
        delay.delayTime.value = 0.09;
        const tone = this.context.createBiquadFilter();
        tone.type = 'lowpass';
        tone.frequency.value = 2500;
        const feedback = this.context.createGain();
        feedback.gain.value = 0.35;
        input.connect(delay).connect(tone).connect(output);
        tone.connect(feedback).connect(delay);
        return input;
    }

    /** A concert hall: decaying noise, darker as it fades. Mono: half the work of a stereo one */
    private createImpulse(): AudioBuffer {
        const rate = this.context.sampleRate;
        const length = Math.floor(rate * AudioBus.REVERB_SECONDS);
        const impulse = this.context.createBuffer(1, length, rate);
        for (let channel = 0; channel < 1; channel++) {
            const data = impulse.getChannelData(channel);
            let smooth = 0;
            for (let i = 0; i < length; i++) {
                const t = i / length;
                // One pole lowpass that closes over time: the tail loses its highs like a real room
                const lowpass = 0.9 - 0.85 * t;
                smooth = smooth * (1 - lowpass) + (Math.random() * 2 - 1) * lowpass;
                data[i] = smooth * Math.pow(1 - t, AudioBus.REVERB_DECAY);
            }
        }
        return impulse;
    }
}
