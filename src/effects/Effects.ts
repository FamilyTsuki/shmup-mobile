import {GameObjects, Scene} from "phaser";
import TextureFactory from "../utils/TextureFactory.ts";

/**
 * Visual feedback that has no gameplay effect: particle bursts and floating texts.
 */
export default class Effects {
    private static readonly FLOAT_DISTANCE: number = 90;
    private static readonly FLOAT_MS: number = 700;

    private readonly _scene: Scene;
    private readonly _emitter: GameObjects.Particles.ParticleEmitter;

    constructor(scene: Scene) {
        this._scene = scene;
        this._emitter = scene.add.particles(0, 0, TextureFactory.PARTICLE_KEY, {
            emitting: false,
            speed: {min: 80, max: 420},
            scale: {start: 1.4, end: 0},
            alpha: {start: 1, end: 0},
            lifespan: {min: 300, max: 700},
            blendMode: 'ADD',
        }).setDepth(50);
    }

    /**
     * @param count particles, more for bigger explosions
     */
    public explosion(x: number, y: number, color: number, count: number) {
        this._emitter.setParticleTint(color);
        this._emitter.explode(count, x, y);
    }

    public floatingText(x: number, y: number, text: string, color: string) {
        const label = this._scene.add.text(x, y, text,
            {fontSize: '44px', color, fontFamily: 'future', stroke: '#000', strokeThickness: 6})
            .setOrigin(0.5).setDepth(60);

        this._scene.tweens.add({
            targets: label,
            y: y - Effects.FLOAT_DISTANCE,
            alpha: {from: 1, to: 0},
            duration: Effects.FLOAT_MS,
            ease: 'Quad.easeOut',
            onComplete: () => label.destroy()
        });
    }
}
