import {Sound} from "phaser";
import AudioBus from "./AudioBus.ts";

/**
 * WebAudio synthesizer for the game sounds: layered noise, filtered saws and sines, sent to a hall reverb,
 * for a cinematic sci-fi feel rather than a chiptune one. Plays through Phaser's master output,
 * so the global mute and the effects volume apply. Silent when the browser has no WebAudio.
 */
export default class Sfx {
    private static readonly MIN_EXPLOSION_GAP_S: number = 0.05;
    private static readonly MIN_ABSORB_GAP_S: number = 0.03;

    private readonly _bus: AudioBus | null;
    private _lastExplosion: number = 0;
    private _lastAbsorb: number = 0;

    constructor(sound: Sound.BaseSoundManager) {
        this._bus = AudioBus.get(sound);
    }

    private get now(): number {
        return this._bus?.context.currentTime ?? 0;
    }

    public explosion(big: boolean = false) {
        if (!this._bus || this.now - this._lastExplosion < Sfx.MIN_EXPLOSION_GAP_S)
            return;
        this._lastExplosion = this.now;

        // Thump + rumble + crackle
        this.sweep(big ? 140 : 180, big ? 28 : 45, big ? 0.9 : 0.35, 'sine', big ? 0.7 : 0.35, 0, big ? 0.3 : 0.1);
        this.noise(big ? 1.6 : 0.45, big ? 0.55 : 0.3, 'lowpass', big ? 900 : 1800, 60, 0, big ? 0.5 : 0.15);
        this.noise(big ? 0.5 : 0.15, big ? 0.18 : 0.1, 'bandpass', 3000, 800, 0.02);
    }

    /** Crystal "ting": two bell partials */
    public coin() {
        const pitch = 1 + Math.random() * 0.06;
        this.sweep(1568 * pitch, 1568 * pitch, 0.35, 'sine', 0.07, 0, 0.2);
        this.sweep(3951 * pitch, 3951 * pitch, 0.15, 'sine', 0.03);
    }

    /** Rising shimmer under a bright chord */
    public powerUp() {
        this.saw(220, 880, 0.45, 0.06, 600, 4000);
        [523, 659, 784, 1047].forEach((frequency, index) =>
            this.sweep(frequency, frequency, 0.6, 'sine', 0.09, index * 0.05, 0.35));
    }

    /** Heavy impact: a dull saw thud and a crunch */
    public playerHit() {
        this.saw(200, 45, 0.35, 0.3, 1200, 120);
        this.noise(0.3, 0.35, 'lowpass', 2500, 200);
        this.sweep(90, 40, 0.4, 'sine', 0.5);
    }

    /** Deep boom with a long tail in the hall */
    public bomb() {
        this.noise(2.2, 0.7, 'lowpass', 1200, 40, 0, 0.6);
        this.sweep(110, 22, 1.6, 'sine', 0.8, 0, 0.3);
        this.saw(80, 30, 1, 0.2, 400, 60);
    }

    /** Glassy soft note, pitched up while the gauge fills */
    public absorb(charge: number) {
        if (!this._bus || this.now - this._lastAbsorb < Sfx.MIN_ABSORB_GAP_S)
            return;
        this._lastAbsorb = this.now;

        const frequency = 600 + charge * 8;
        this.sweep(frequency, frequency * 1.25, 0.18, 'sine', 0.06, 0, 0.3);
    }

    /** A whoosh up for ION, down for PLASMA */
    public polaritySwitch(toIon: boolean) {
        this.noise(0.22, 0.2, 'bandpass', toIon ? 600 : 4000, toIon ? 4000 : 600);
        this.sweep(toIon ? 250 : 700, toIon ? 700 : 250, 0.15, 'sine', 0.1);
    }

    /** The resonance release: a deep impact under a swelling chord */
    public burst(strength: number) {
        this.noise(0.9, 0.3 * strength + 0.2, 'bandpass', 500, 5000, 0, 0.3);
        this.sweep(80, 30, 0.8, 'sine', 0.6);
        [392, 523, 784].forEach((frequency, index) =>
            this.saw(frequency, frequency * 2, 0.5, 0.05, 800, 5000, index * 0.03));
    }

    /** One letter of a dialogue: a soft wooden tick */
    public blip(pitch: number = 1) {
        this.sweep(700 * pitch, 500 * pitch, 0.04, 'sine', 0.06);
    }

    /** Menus: a short soft click */
    public click() {
        this.noise(0.03, 0.12, 'highpass', 3000, 3000);
        this.sweep(900, 600, 0.06, 'sine', 0.08);
    }

    /** Coop high-five: a real clap, three quick noise bursts */
    public clap() {
        for (let i = 0; i < 3; i++)
            this.noise(i === 2 ? 0.15 : 0.02, 0.4, 'bandpass', 1400, 1100, i * 0.012, 0.15);
    }

    /** Coop ghost: a wobbly "boooo" */
    public boo() {
        this.sweep(320, 180, 0.7, 'sine', 0.22, 0, 0.3);
        this.sweep(330, 190, 0.7, 'triangle', 0.08, 0.03);
    }

    /** Bell arpeggio: someone is back */
    public revive() {
        [392, 523, 659, 784].forEach((frequency, index) =>
            this.sweep(frequency, frequency, 0.5, 'sine', 0.1, index * 0.08, 0.35));
    }

    /** Boss warning: two long brassy horn blasts */
    public alarm() {
        for (let i = 0; i < 2; i++) {
            this.saw(73, 70, 0.9, 0.22, 300, 1400, i * 1.1);
            this.saw(110, 105, 0.9, 0.12, 300, 1800, i * 1.1);
        }
    }

    // ------------------------------------------------------------------ building blocks

    /** A pitched tone gliding between two frequencies */
    private sweep(fromHz: number, toHz: number, duration: number, type: OscillatorType, volume: number,
                  delay: number = 0, reverb: number = 0) {
        if (!this._bus)
            return;
        const context = this._bus.context;
        const start = context.currentTime + delay;
        const oscillator = context.createOscillator();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(fromHz, start);
        oscillator.frequency.exponentialRampToValueAtTime(toHz, start + duration);

        const gain = this.decay(start, duration, volume);
        oscillator.connect(gain);
        this.route(gain, reverb);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
    }

    /** Two detuned saws behind a moving lowpass: brassy or growling depending on the filter */
    private saw(fromHz: number, toHz: number, duration: number, volume: number, filterFrom: number, filterTo: number,
                delay: number = 0) {
        if (!this._bus)
            return;
        const context = this._bus.context;
        const start = context.currentTime + delay;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 2;
        filter.frequency.setValueAtTime(filterFrom, start);
        filter.frequency.exponentialRampToValueAtTime(filterTo, start + duration * 0.6);

        const gain = this.decay(start, duration, volume, 0.02);
        filter.connect(gain);
        this.route(gain, 0.2);

        for (const detune of [-10, 10]) {
            const oscillator = context.createOscillator();
            oscillator.type = 'sawtooth';
            oscillator.detune.value = detune;
            oscillator.frequency.setValueAtTime(fromHz, start);
            oscillator.frequency.exponentialRampToValueAtTime(toHz, start + duration);
            oscillator.connect(filter);
            oscillator.start(start);
            oscillator.stop(start + duration + 0.02);
        }
    }

    private noise(duration: number, volume: number, type: BiquadFilterType, fromHz: number, toHz: number,
                  delay: number = 0, reverb: number = 0) {
        if (!this._bus)
            return;
        const context = this._bus.context;
        const start = context.currentTime + delay;
        const source = context.createBufferSource();
        source.buffer = this._bus.noise;
        source.loop = true;

        const filter = context.createBiquadFilter();
        filter.type = type;
        filter.frequency.setValueAtTime(fromHz, start);
        filter.frequency.exponentialRampToValueAtTime(toHz, start + duration);

        const gain = this.decay(start, duration, volume);
        source.connect(filter).connect(gain);
        this.route(gain, reverb);
        source.start(start, Math.random() * 0.5);
        source.stop(start + duration + 0.02);
    }

    /** Fast attack, exponential fade */
    private decay(start: number, duration: number, volume: number, attack: number = 0.004): GainNode {
        const gain = this._bus!.context.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        return gain;
    }

    private route(node: AudioNode, reverb: number) {
        node.connect(this._bus!.sfx);
        if (reverb > 0) {
            const send = this._bus!.context.createGain();
            send.gain.value = reverb;
            node.connect(send).connect(this._bus!.sfxReverb);
        }
    }
}
