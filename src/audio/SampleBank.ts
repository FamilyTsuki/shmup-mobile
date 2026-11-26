import {Scene, Sound} from "phaser";

type Render = (context: OfflineAudioContext) => void;

/**
 * Renders the shot sounds once at boot and puts them in the audio cache under the keys of the sample files
 * they replace. Everything keeps calling sound.play('sfx_laser1'), which coop also replays on the guests;
 * the files stay loaded as a fallback for browsers without OfflineAudioContext.
 */
export default class SampleBank {
    private static _rendered: boolean = false;

    public static render(scene: Scene) {
        if (SampleBank._rendered || !(scene.sound instanceof Sound.WebAudioSoundManager)
            || typeof OfflineAudioContext === 'undefined')
            return;
        SampleBank._rendered = true;

        const rate = scene.sound.context.sampleRate;
        SampleBank.renderInto(scene, 'sfx_laser1', 0.16, rate, SampleBank.playerShot);
        SampleBank.renderInto(scene, 'sfx_laser2', 0.24, rate, SampleBank.enemyShot);
    }

    /** Player: a bright, short plasma "tchew" */
    private static playerShot(context: OfflineAudioContext) {
        SampleBank.zap(context, 2200, 380, 0.14, 0.45, 5000);
        SampleBank.zap(context, 1100, 190, 0.12, 0.25, 2500);
        SampleBank.click(context, 0.02, 0.3);
    }

    /** Enemies: lower and rounder, easy to tell apart from the player's shots */
    private static enemyShot(context: OfflineAudioContext) {
        SampleBank.zap(context, 900, 140, 0.22, 0.5, 1800);
        SampleBank.zap(context, 450, 90, 0.2, 0.3, 900);
    }

    private static zap(context: OfflineAudioContext, fromHz: number, toHz: number, duration: number, volume: number,
                       cutoff: number) {
        const oscillator = context.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(fromHz, 0);
        oscillator.frequency.exponentialRampToValueAtTime(toHz, duration);
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 4;
        filter.frequency.setValueAtTime(cutoff, 0);
        filter.frequency.exponentialRampToValueAtTime(cutoff / 6, duration);
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.0001, 0);
        gain.gain.exponentialRampToValueAtTime(volume, 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, duration);
        oscillator.connect(filter).connect(gain).connect(context.destination);
        oscillator.start(0);
        oscillator.stop(duration);
    }

    /** A tiny noise transient for the attack */
    private static click(context: OfflineAudioContext, duration: number, volume: number) {
        const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++)
            data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const source = context.createBufferSource();
        source.buffer = buffer;
        const filter = context.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 3000;
        const gain = context.createGain();
        gain.gain.value = volume;
        source.connect(filter).connect(gain).connect(context.destination);
        source.start(0);
    }

    private static renderInto(scene: Scene, key: string, seconds: number, rate: number, render: Render) {
        const context = new OfflineAudioContext(1, Math.ceil(rate * seconds), rate);
        render(context);
        context.startRendering().then((buffer) => {
            const cache = scene.game.cache.audio;
            if (cache.exists(key))
                cache.remove(key);
            cache.add(key, buffer);
        }).catch((error) => console.error(`[SampleBank] ${key} failed`, error));
    }
}
