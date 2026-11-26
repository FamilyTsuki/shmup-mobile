import {Sound} from "phaser";
import AudioBus from "./AudioBus.ts";

export type MusicTrack = 'menu' | 'level' | 'boss';
export type MusicStinger = 'victory' | 'defeat';

/** [step in the loop (16th notes), MIDI note, length in steps] */
type Note = [number, number, number];

type TrackData = {
    bpm: number;
    /** One chord per bar, low to high, MIDI notes; the first one is the bass root */
    chords: number[][];
    /** Lead line over the whole loop */
    melody: Note[];
    /** Called for each 16th note: schedules what the track plays at that step */
    play: (music: Music, step: number, time: number, chord: number[], stepSeconds: number) => void;
};

type Playing = {
    key: MusicTrack;
    data: TrackData;
    fader: GainNode;
    step: number;
    nextTime: number;
};

const STEPS_PER_BAR: number = 16;

const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/**
 * Orchestral style music synthesized on the fly: strings, brass, choir, plucked harp and taiko drums
 * played through a hall reverb. Nothing to download, and the tracks loop without a seam.
 *
 * A lookahead scheduler places the notes a little ahead of the audio clock, so a slow frame never
 * makes the rhythm stumble. Changing track crossfades.
 */
export default class Music {
    private static _instance: Music | null = null;

    private static readonly LOOKAHEAD_S: number = 0.15;
    private static readonly TICK_MS: number = 25;
    private static readonly FADE_S: number = 1.2;
    /** Each track sends this much of its sound to the hall */
    private static readonly REVERB_SEND: number = 0.32;

    private readonly _bus: AudioBus;
    private _current: Playing | null = null;

    public static get(sound: Sound.BaseSoundManager): Music | null {
        if (Music._instance)
            return Music._instance;
        const bus = AudioBus.get(sound);
        if (!bus)
            return null;
        Music._instance = new Music(bus);
        return Music._instance;
    }

    /** Starts a track, or keeps it going when it is already the one playing */
    public static play(sound: Sound.BaseSoundManager, track: MusicTrack) {
        Music.get(sound)?.play(track);
    }

    public static stinger(sound: Sound.BaseSoundManager, stinger: MusicStinger) {
        Music.get(sound)?.stinger(stinger);
    }

    private constructor(bus: AudioBus) {
        this._bus = bus;
        window.setInterval(() => this.tick(), Music.TICK_MS);
    }

    public play(track: MusicTrack) {
        if (this._current?.key === track)
            return;

        this.fadeOutCurrent();
        const context = this._bus.context;
        const fader = context.createGain();
        fader.gain.setValueAtTime(0.0001, context.currentTime);
        fader.gain.exponentialRampToValueAtTime(1, context.currentTime + Music.FADE_S);
        fader.connect(this._bus.music);
        const send = context.createGain();
        send.gain.value = Music.REVERB_SEND;
        fader.connect(send).connect(this._bus.musicReverb);

        this._current = {key: track, data: TRACKS[track], fader, step: 0, nextTime: context.currentTime + 0.05};
    }

    /** A short phrase at the end of a run; the next play() starts a track again */
    public stinger(stinger: MusicStinger) {
        this.fadeOutCurrent(0.4);
        this._current = null;

        const context = this._bus.context;
        const out = context.createGain();
        out.connect(this._bus.music);
        const send = context.createGain();
        send.gain.value = 0.6;
        out.connect(send).connect(this._bus.musicReverb);
        const t = context.currentTime + 0.1;

        if (stinger === 'victory') {
            // D major fanfare climbing to a held chord
            [62, 66, 69].forEach((midi, i) => this.brass(out, hz(midi), t + i * 0.16, 0.2, 0.14));
            [50, 62, 66, 69, 74].forEach(midi => this.strings(out, hz(midi), t + 0.48, 2.6, 0.07));
            [74, 78, 81].forEach(midi => this.brass(out, hz(midi), t + 0.48, 2.2, 0.11));
            this.taiko(out, t + 0.48, 0.9);
            this.crash(out, t + 0.48, 0.18);
        } else {
            // Low strings sinking into D minor, a gong underneath
            [[57, 0], [55, 0.5], [53, 1], [50, 1.5]].forEach(([midi, at]) =>
                this.strings(out, hz(midi - 12), t + at, 0.6, 0.12));
            [38, 50, 53, 57].forEach(midi => this.strings(out, hz(midi), t + 2, 2.8, 0.08));
            this.choir(out, hz(62), t + 2, 2.6, 0.05);
            this.taiko(out, t + 2, 1);
            this.crash(out, t + 2, 0.12);
        }
    }

    private fadeOutCurrent(seconds: number = Music.FADE_S) {
        if (!this._current)
            return;
        const fader = this._current.fader;
        const now = this._bus.context.currentTime;
        fader.gain.cancelScheduledValues(now);
        fader.gain.setValueAtTime(Math.max(0.0001, fader.gain.value), now);
        fader.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
        // Notes already scheduled die in the faded node; let it go once silent
        window.setTimeout(() => fader.disconnect(), (seconds + 3) * 1000);
    }

    private tick() {
        const playing = this._current;
        const context = this._bus.context;
        if (!playing || context.state !== 'running')
            return;

        // Back from a throttled background tab: start again from now instead of rushing to catch up
        if (playing.nextTime < context.currentTime - 0.1)
            playing.nextTime = context.currentTime + 0.05;

        const stepSeconds = 60 / playing.data.bpm / 4;
        const loopSteps = playing.data.chords.length * STEPS_PER_BAR;
        while (playing.nextTime < context.currentTime + Music.LOOKAHEAD_S) {
            const chord = playing.data.chords[Math.floor(playing.step / STEPS_PER_BAR)];
            playing.data.play(this, playing.step, playing.nextTime, chord, stepSeconds);
            for (const [step, midi, length] of playing.data.melody) {
                if (step === playing.step)
                    this.brass(playing.fader, hz(midi), playing.nextTime, length * stepSeconds, 0.085);
            }
            playing.step = (playing.step + 1) % loopSteps;
            playing.nextTime += stepSeconds;
        }
    }

    /** Output of the track playing, for the parts */
    public get out(): AudioNode {
        return this._current!.fader;
    }

    // ------------------------------------------------------------------ instruments

    /** Ensemble strings: three detuned saws through a soft filter, slow bow attack */
    public strings(out: AudioNode, frequency: number, time: number, duration: number, volume: number,
                   attack: number = 0.25) {
        const context = this._bus.context;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = Math.min(4000, 900 + frequency * 2);
        filter.Q.value = 0.5;
        const gain = this.envelope(time, duration, volume, Math.min(attack, duration * 0.5), 0.5);
        filter.connect(gain).connect(out);

        for (const detune of [-9, 0, 9]) {
            const oscillator = context.createOscillator();
            oscillator.type = 'sawtooth';
            oscillator.frequency.value = frequency;
            oscillator.detune.value = detune;
            oscillator.connect(filter);
            oscillator.start(time);
            oscillator.stop(time + duration + 0.6);
        }
    }

    /** Brass: a bright filter sweep at the attack gives the "blare" */
    public brass(out: AudioNode, frequency: number, time: number, duration: number, volume: number) {
        const context = this._bus.context;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 1.5;
        filter.frequency.setValueAtTime(350, time);
        filter.frequency.exponentialRampToValueAtTime(Math.min(5000, frequency * 7), time + 0.07);
        filter.frequency.exponentialRampToValueAtTime(Math.min(3000, frequency * 4), time + 0.3);
        const gain = this.envelope(time, duration, volume, 0.04, 0.18);
        filter.connect(gain).connect(out);

        for (const detune of [-6, 6]) {
            const oscillator = context.createOscillator();
            oscillator.type = 'sawtooth';
            oscillator.frequency.value = frequency;
            oscillator.detune.value = detune;
            oscillator.connect(filter);
            oscillator.start(time);
            oscillator.stop(time + duration + 0.3);
        }
    }

    /** "Aah" choir: saws through two vowel formants, with a slow vibrato */
    public choir(out: AudioNode, frequency: number, time: number, duration: number, volume: number) {
        const context = this._bus.context;
        const gain = this.envelope(time, duration, volume, 0.6, 0.8);
        gain.connect(out);
        const mix = context.createGain();
        for (const [formant, q] of [[780, 6], [1150, 8], [2500, 10]]) {
            const band = context.createBiquadFilter();
            band.type = 'bandpass';
            band.frequency.value = formant;
            band.Q.value = q;
            mix.connect(band).connect(gain);
        }
        mix.gain.value = 3;

        const vibrato = context.createOscillator();
        vibrato.frequency.value = 5;
        const depth = context.createGain();
        depth.gain.value = 8;
        vibrato.connect(depth);
        for (const detune of [-7, 7]) {
            const oscillator = context.createOscillator();
            oscillator.type = 'sawtooth';
            oscillator.frequency.value = frequency;
            oscillator.detune.value = detune;
            depth.connect(oscillator.detune);
            oscillator.connect(mix);
            oscillator.start(time);
            oscillator.stop(time + duration + 1);
        }
        vibrato.start(time);
        vibrato.stop(time + duration + 1);
    }

    /** Low ostinato: saw and sine under a closing filter */
    public bass(out: AudioNode, frequency: number, time: number, duration: number, volume: number) {
        const context = this._bus.context;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 3;
        filter.frequency.setValueAtTime(1400, time);
        filter.frequency.exponentialRampToValueAtTime(260, time + duration);
        const gain = this.envelope(time, duration, volume, 0.008, 0.08);
        filter.connect(gain).connect(out);

        for (const type of ['sawtooth', 'sine'] as OscillatorType[]) {
            const oscillator = context.createOscillator();
            oscillator.type = type;
            oscillator.frequency.value = frequency;
            oscillator.connect(filter);
            oscillator.start(time);
            oscillator.stop(time + duration + 0.1);
        }
    }

    /** Plucked harp: a saw whose filter closes fast, long ring */
    public harp(out: AudioNode, frequency: number, time: number, volume: number) {
        const context = this._bus.context;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.min(6000, frequency * 6), time);
        filter.frequency.exponentialRampToValueAtTime(frequency * 1.2, time + 0.5);
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(volume, time + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.6);
        filter.connect(gain).connect(out);

        const oscillator = context.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = frequency;
        oscillator.connect(filter);
        oscillator.start(time);
        oscillator.stop(time + 1.7);
    }

    /** Big drum: a falling sine for the body, a burst of dark noise for the skin */
    public taiko(out: AudioNode, time: number, volume: number) {
        const context = this._bus.context;
        const oscillator = context.createOscillator();
        oscillator.frequency.setValueAtTime(120, time);
        oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.4);
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(volume * 0.55, time + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.7);
        oscillator.connect(gain).connect(out);
        oscillator.start(time);
        oscillator.stop(time + 0.75);

        this.noiseHit(out, time, 0.15, volume * 0.35, 'lowpass', 500);
    }

    /** Orchestral snare: bright noise and a short tonal knock */
    public snare(out: AudioNode, time: number, volume: number) {
        this.noiseHit(out, time, 0.2, volume * 0.3, 'bandpass', 2200);
        const context = this._bus.context;
        const oscillator = context.createOscillator();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(220, time);
        oscillator.frequency.exponentialRampToValueAtTime(140, time + 0.08);
        const gain = context.createGain();
        gain.gain.setValueAtTime(volume * 0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
        oscillator.connect(gain).connect(out);
        oscillator.start(time);
        oscillator.stop(time + 0.12);
    }

    public shaker(out: AudioNode, time: number, volume: number) {
        this.noiseHit(out, time, 0.05, volume * 0.08, 'highpass', 7500);
    }

    public crash(out: AudioNode, time: number, volume: number) {
        this.noiseHit(out, time, 2.2, volume, 'highpass', 4500);
    }

    private noiseHit(out: AudioNode, time: number, duration: number, volume: number, type: BiquadFilterType,
                     frequency: number) {
        const context = this._bus.context;
        const source = context.createBufferSource();
        source.buffer = this._bus.noise;
        const filter = context.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = frequency;
        const gain = context.createGain();
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        source.connect(filter).connect(gain).connect(out);
        source.start(time, Math.random() * 0.5);
        source.stop(time + duration);
    }

    /** Attack, hold, release; the gain node is returned to connect the sound source into */
    private envelope(time: number, duration: number, volume: number, attack: number, release: number): GainNode {
        const gain = this._bus.context.createGain();
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(volume, time + attack);
        gain.gain.setValueAtTime(volume, time + Math.max(attack, duration));
        gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(attack, duration) + release);
        return gain;
    }
}

// ---------------------------------------------------------------------- tracks

/** Title and menus: slow D minor, strings and choir, a harp rippling over it */
const MENU: TrackData = {
    bpm: 72,
    chords: [
        [38, 50, 57, 62, 65], [34, 46, 53, 58, 62], [41, 53, 57, 60, 65], [36, 48, 55, 60, 64],
        [38, 50, 57, 62, 65], [34, 46, 53, 58, 62], [31, 43, 55, 58, 62], [33, 45, 57, 61, 64],
    ],
    melody: [],
    play(music, step, time, chord, stepSeconds) {
        const out = music.out;
        const inBar = step % STEPS_PER_BAR;
        const bar = stepSeconds * STEPS_PER_BAR;
        if (inBar === 0) {
            chord.slice(1).forEach(midi => music.strings(out, hz(midi), time, bar, 0.035, 0.8));
            music.strings(out, hz(chord[0]), time, bar, 0.05, 0.6);
            music.choir(out, hz(chord[chord.length - 1] + 12), time, bar, 0.025);
            if (step % (STEPS_PER_BAR * 4) === 0)
                music.taiko(out, time, 0.35);
        }
        // Harp: up the chord in 8th notes, an octave higher
        if (inBar % 2 === 0) {
            const notes = chord.slice(1);
            const midi = notes[(inBar / 2) % notes.length] + 12 + (inBar >= 8 ? 12 : 0);
            music.harp(out, hz(midi), time, 0.05);
        }
    },
};

/** Levels: driving A minor, bass ostinato and taiko, brass theme on the second half */
const LEVEL: TrackData = {
    bpm: 124,
    chords: [
        [33, 57, 60, 64], [29, 57, 60, 65], [36, 55, 60, 64], [31, 55, 59, 62],
        [33, 57, 60, 64], [29, 57, 60, 65], [31, 55, 59, 62], [28, 56, 59, 64],
    ],
    melody: [
        [64, 69, 6], [70, 72, 2], [72, 76, 8],
        [80, 77, 6], [86, 76, 2], [88, 72, 8],
        [96, 74, 6], [102, 72, 2], [104, 71, 8],
        [112, 76, 12], [124, 68, 4],
    ],
    play(music, step, time, chord, stepSeconds) {
        const out = music.out;
        const inBar = step % STEPS_PER_BAR;
        const root = chord[0];
        if (inBar === 0)
            chord.slice(1).forEach(midi => music.strings(out, hz(midi), time, stepSeconds * STEPS_PER_BAR, 0.03));
        // Galloping 8ths, the octave jump on the off-beats
        if (inBar % 2 === 0)
            music.bass(out, hz(root + (inBar % 8 === 6 ? 12 : 0)), time, stepSeconds * 1.6, 0.14);
        if (inBar === 0 || inBar === 6 || inBar === 8)
            music.taiko(out, time, inBar === 0 ? 0.9 : 0.6);
        if (inBar === 4 || inBar === 12)
            music.snare(out, time, 0.7);
        if (inBar % 2 === 1)
            music.shaker(out, time, 1);
        // Brass stab every other bar
        if (inBar === 0 && Math.floor(step / STEPS_PER_BAR) % 2 === 0)
            chord.slice(1).forEach(midi => music.brass(out, hz(midi), time, stepSeconds * 3, 0.04));
    },
};

/** Bosses: fast D minor, 16th note bass, choir, heavy drums and a brass theme all along */
const BOSS: TrackData = {
    bpm: 148,
    chords: [
        [38, 62, 65, 69], [34, 62, 65, 70], [31, 62, 67, 70], [33, 61, 64, 69],
        [38, 62, 65, 69], [34, 62, 65, 70], [36, 60, 64, 67], [33, 61, 64, 69],
    ],
    melody: [
        [0, 74, 6], [6, 76, 2], [8, 77, 8],
        [16, 74, 6], [22, 72, 2], [24, 70, 8],
        [32, 67, 6], [38, 70, 2], [40, 74, 8],
        [48, 73, 12], [60, 69, 4],
        [64, 74, 4], [68, 77, 4], [72, 81, 8],
        [80, 82, 6], [86, 81, 2], [88, 77, 8],
        [96, 79, 6], [102, 77, 2], [104, 76, 8],
        [112, 73, 8], [120, 76, 4], [124, 69, 4],
    ],
    play(music, step, time, chord, stepSeconds) {
        const out = music.out;
        const inBar = step % STEPS_PER_BAR;
        const root = chord[0];
        const bar = stepSeconds * STEPS_PER_BAR;
        if (inBar === 0) {
            chord.slice(1).forEach(midi => music.choir(out, hz(midi - 12), time, bar, 0.03));
            if (step % (STEPS_PER_BAR * 4) === 0)
                music.crash(out, time, 0.12);
        }
        // Relentless 16ths, accented on the beat
        music.bass(out, hz(root + (inBar % 4 === 2 ? 12 : 0)), time, stepSeconds * 0.9, inBar % 4 === 0 ? 0.16 : 0.1);
        // Staccato strings in 8ths
        if (inBar % 2 === 0)
            chord.slice(1).forEach(midi => music.strings(out, hz(midi), time, stepSeconds * 0.8, 0.018, 0.01));
        if ([0, 3, 6, 8, 11, 14].includes(inBar))
            music.taiko(out, time, inBar === 0 || inBar === 8 ? 1 : 0.6);
        if (inBar === 4 || inBar === 12)
            music.snare(out, time, 0.9);
    },
};

const TRACKS: Record<MusicTrack, TrackData> = {menu: MENU, level: LEVEL, boss: BOSS};
