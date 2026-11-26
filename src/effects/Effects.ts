import {GameObjects, Scene} from "phaser";
import TextureFactory from "../utils/TextureFactory.ts";
import UiStyle from "../ui/UiStyle.ts";

/**
 * Visual feedback that has no gameplay effect: particle bursts, shock rings and floating texts.
 */
export default class Effects {
    private static readonly FLOAT_DISTANCE: number = 90;
    private static readonly FLOAT_MS: number = 700;

    private readonly _scene: Scene;
    private readonly _emitter: GameObjects.Particles.ParticleEmitter;
    private readonly _sparks: GameObjects.Particles.ParticleEmitter;

    constructor(scene: Scene) {
        this._scene = scene;
        this._emitter = scene.add.particles(0, 0, TextureFactory.PARTICLE_KEY, {
            emitting: false,
            speed: {min: 80, max: 420},
            scale: {start: 1.6, end: 0.4},
            alpha: {start: 1, end: 0},
            lifespan: {min: 300, max: 700},
            blendMode: 'NORMAL',
        }).setDepth(50);

        // Streaks flying outward, rotated along their direction
        this._sparks = scene.add.particles(0, 0, TextureFactory.SPARK_KEY, {
            emitting: false,
            speed: {min: 300, max: 900},
            scaleX: {start: 1.2, end: 0.2},
            scaleY: 1,
            alpha: {start: 1, end: 0},
            lifespan: {min: 180, max: 380},
            rotate: {
                onEmit: () => 0,
                onUpdate: (particle: GameObjects.Particles.Particle) =>
                    Phaser.Math.RadToDeg(Math.atan2(particle.velocityY, particle.velocityX)),
            },
            blendMode: 'NORMAL',
        }).setDepth(51);
    }

    /**
     * @param count particles, more for bigger explosions
     */
    public explosion(x: number, y: number, color: number, count: number) {
        this._emitter.setParticleTint(color);
        this._emitter.explode(count, x, y);
        this._sparks.setParticleTint(color);
        this._sparks.explode(Math.ceil(count / 2), x, y);
        this.ring(x, y, color, Math.min(80 + count * 4, 420), 380);
    }

    /** Small flash where a bullet got absorbed */
    public absorb(x: number, y: number, color: number) {
        this._emitter.setParticleTint(color);
        this._emitter.explode(3, x, y);
        this.ring(x, y, color, 40, 180);
    }

    /**
     * An expanding ring, from a point to radius px.
     */
    public ring(x: number, y: number, color: number, radius: number, durationMs: number) {
        const ring = this._scene.add.image(x, y, TextureFactory.RING_KEY)
            .setTint(color).setDepth(49).setScale(0.05);
        this._scene.tweens.add({
            targets: ring,
            scale: radius / TextureFactory.RING_RADIUS,
            alpha: {from: 1, to: 0},
            duration: durationMs,
            ease: 'Cubic.easeOut',
            onComplete: () => ring.destroy()
        });
    }

    public floatingText(x: number, y: number, text: string, color: string) {
        const label = this._scene.add.text(x, y, UiStyle.upper(text),
            UiStyle.text(44, color)).setOrigin(0.5).setDepth(60);

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
