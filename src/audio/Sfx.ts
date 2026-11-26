import {Sound} from "phaser";

/**
 * Small WebAudio synthesizer for the sounds the asset pack lacks. Plays through Phaser's sound manager
 * output, so the global mute applies. Silent when the browser has no WebAudio.
 */
export default class Sfx {
    private static readonly MIN_EXPLOSION_GAP_S: number = 0.05;
    private static readonly MIN_ABSORB_GAP_S: number = 0.03;

    private readonly _context: AudioContext | null;
    private readonly _output: AudioNode | null;
    private _noise: AudioBuffer | null = null;
    private _lastExplosion: number = 0;
    private _lastAbsorb: number = 0;

    constructor(sound: Sound.BaseSoundManager) {
        const webAudio = sound instanceof Sound.WebAudioSoundManager ? sound : null;
        this._context = webAudio?.context ?? null;
        this._output = webAudio?.destination ?? null;
    }

    public explosion(big: boolean = false) {
        if (!this._context || this._context.currentTime - this._lastExplosion < Sfx.MIN_EXPLOSION_GAP_S)
            return;
        this._lastExplosion = this._context.currentTime;

        this.noise(big ? 0.7 : 0.25, big ? 0.5 : 0.25, big ? 700 : 1600);
        if (big)
            this.tone(120, 30, 0.7, 'sine', 0.5);
    }

    public coin() {
        this.tone(988, 1319, 0.07, 'square', 0.06);
    }

    public powerUp() {
        [523, 659, 784, 1047].forEach((frequency, index) =>
            this.tone(frequency, frequency, 0.08, 'triangle', 0.18, index * 0.06));
    }

    public playerHit() {
        this.tone(320, 60, 0.3, 'sawtooth', 0.2);
        this.noise(0.2, 0.2, 900);
    }

    public bomb() {
        this.noise(1, 0.6, 500);
        this.tone(90, 25, 1, 'sine', 0.6);
    }

    /** Soft high blip, pitched up while the gauge fills */
    public absorb(charge: number) {
        if (!this._context || this._context.currentTime - this._lastAbsorb < Sfx.MIN_ABSORB_GAP_S)
            return;
        this._lastAbsorb = this._context.currentTime;

        const frequency = 700 + charge * 9;
        this.tone(frequency, frequency * 1.5, 0.06, 'sine', 0.08);
    }

    /** Short sweep up for ION, down for PLASMA */
    public polaritySwitch(toIon: boolean) {
        this.tone(toIon ? 300 : 900, toIon ? 900 : 300, 0.09, 'triangle', 0.12);
    }

    /** The resonance release: a deep thump under a rising chord */
    public burst(strength: number) {
        this.noise(0.5, 0.35 * strength + 0.15, 1200);
        this.tone(70, 35, 0.6, 'sine', 0.5);
        [392, 523, 784].forEach((frequency, index) =>
            this.tone(frequency, frequency * 2, 0.35, 'sawtooth', 0.05, index * 0.04));
    }

    /** One letter of a dialogue: a tiny square wave tick */
    public blip(pitch: number = 1) {
        this.tone(520 * pitch, 520 * pitch, 0.03, 'square', 0.04);
    }

    /** Coop high-five: a short bright crack */
    public clap() {
        this.noise(0.08, 0.5, 6000);
        this.tone(1200, 900, 0.05, 'square', 0.06);
    }

    /** Coop ghost: a wobbly "boooo" */
    public boo() {
        this.tone(320, 180, 0.6, 'sine', 0.25);
        this.tone(330, 190, 0.6, 'triangle', 0.12, 0.03);
    }

    /** Two notes up: someone is back */
    public revive() {
        [392, 523, 659, 784].forEach((frequency, index) =>
            this.tone(frequency, frequency, 0.09, 'square', 0.08, index * 0.07));
    }

    public alarm() {
        for (let i = 0; i < 4; i++)
            this.tone(i % 2 === 0 ? 440 : 660, i % 2 === 0 ? 440 : 660, 0.18, 'square', 0.08, i * 0.2);
    }

    private tone(fromHz: number, toHz: number, duration: number, type: OscillatorType, volume: number,
                 delay: number = 0) {
        if (!this._context || !this._output)
            return;

        const start = this._context.currentTime + delay;
        const oscillator = this._context.createOscillator();
        const gain = this._context.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(fromHz, start);
        oscillator.frequency.exponentialRampToValueAtTime(toHz, start + duration);
        gain.gain.setValueAtTime(volume, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        oscillator.connect(gain).connect(this._output);
        oscillator.start(start);
        oscillator.stop(start + duration);
    }

    private noise(duration: number, volume: number, lowpassHz: number) {
        if (!this._context || !this._output)
            return;

        const start = this._context.currentTime;
        const source = this._context.createBufferSource();
        source.buffer = this.noiseBuffer(this._context);

        const filter = this._context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(lowpassHz, start);
        filter.frequency.exponentialRampToValueAtTime(60, start + duration);

        const gain = this._context.createGain();
        gain.gain.setValueAtTime(volume, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        source.connect(filter).connect(gain).connect(this._output);
        source.start(start);
        source.stop(start + duration);
    }

    private noiseBuffer(context: AudioContext): AudioBuffer {
        if (!this._noise) {
            this._noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
            const samples = this._noise.getChannelData(0);
            for (let i = 0; i < samples.length; i++)
                samples[i] = Math.random() * 2 - 1;
        }
        return this._noise;
    }
}
