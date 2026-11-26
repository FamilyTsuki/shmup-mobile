import {BulletData} from "../gameData/BulletData.ts";
import type {Polarity} from "../gameData/PolarityData.ts";
import TextureFactory from "../utils/TextureFactory.ts";

type Point = { x: number, y: number, active?: boolean };

/**
 * A pooled bullet. Besides flying straight, boss patterns can make it wait then launch at a point,
 * disappear after a while, or fly back home like a boomerang.
 */
export default class Bullet extends Phaser.GameObjects.Image {
    /** A returning bullet vanishes this close to its target */
    private static readonly CATCH_DISTANCE: number = 50;

    private _arcadeBody: Phaser.Physics.Arcade.Body;

    private _damage: number = 0;
    private _polarity: Polarity = 'ion';
    private _speed: number = 0;
    private _ageMs: number = 0;
    private _lifetimeMs: number = 0;
    private _launchAtMs: number = -1;
    private _launchTarget: Point | null = null;
    private _returnAtMs: number = -1;
    private _returnTarget: Point | null = null;
    private _returning: boolean = false;

    public get damage(): number {
        return this._damage;
    }

    public get polarity(): Polarity {
        return this._polarity;
    }

    public init() {
        this.scene.physics.add.existing(this);

        this._arcadeBody = this.body as Phaser.Physics.Arcade.Body;
        this._arcadeBody.allowGravity = false;
        this._arcadeBody.setFriction(0, 0);
    }

    public enable(x: number, y: number, velocityX: number, velocityY: number, data: BulletData) {
        const key = TextureFactory.bulletKey(data.shape, data.polarity);
        this.setTexture(key);
        this.setPosition(x, y);
        this.setOrigin(0.5);

        // Scale the texture so its core matches the size from the data
        const body = TextureFactory.bodyData(this.scene, key);
        const coreSize = body.coreSize ?? this.height;
        this.setScale((data.shape === 'orb' ? data.width : data.height) / coreSize);

        this.scene.physics.world.add(this._arcadeBody);
        this.setActive(true);
        this.setVisible(true);

        // Arcade bodies can't rotate: a circle on the core fits any direction
        this._arcadeBody.setCircle(body.hitRadius, this.width / 2 - body.hitRadius, this.height / 2 - body.hitRadius);
        this._arcadeBody.setVelocity(velocityX, velocityY);
        this._damage = data.damage;
        this._polarity = data.polarity;
        this._speed = data.speed;
        this._ageMs = 0;
        this._lifetimeMs = 0;
        this._launchAtMs = -1;
        this._launchTarget = null;
        this._returnAtMs = -1;
        this._returnTarget = null;
        this._returning = false;

        // Rotate the bullet to face the direction it's moving
        this.setRotation(this._arcadeBody.velocity.angle());

        // Maths way
        // this.setRotation(Math.atan2(velocityY, velocityX));
    }

    /** Stays still for holdMs, then flies at the point at its normal speed */
    public holdThenLaunch(holdMs: number, target: Point) {
        this._arcadeBody.setVelocity(0, 0);
        this._launchAtMs = holdMs;
        this._launchTarget = {x: target.x, y: target.y};
    }

    public expireAfter(lifetimeMs: number) {
        this._lifetimeMs = lifetimeMs;
    }

    /** After returnAfterMs, homes in on the target (usually its shooter) and vanishes when it gets there */
    public returnAfter(returnAfterMs: number, target: Point) {
        this._returnAtMs = returnAfterMs;
        this._returnTarget = target;
    }

    private flyTo(x: number, y: number) {
        const angle = Phaser.Math.Angle.Between(this.x, this.y, x, y);
        this._arcadeBody.setVelocity(Math.cos(angle) * this._speed, Math.sin(angle) * this._speed);
        this.setRotation(angle);
    }

    public disable() {
        this.scene.physics.world.disableBody(this._arcadeBody);
        this.setActive(false);
        this.setVisible(false);
    }

    update(timeSinceLaunch: number, deltaTime: number) {
        super.update(timeSinceLaunch, deltaTime);
        if (!this.active)
            return;

        this._ageMs += deltaTime;
        if (this._lifetimeMs > 0 && this._ageMs >= this._lifetimeMs) {
            this.disable();
            return;
        }
        if (this._launchAtMs >= 0 && this._ageMs >= this._launchAtMs && this._launchTarget) {
            this._launchAtMs = -1;
            this.flyTo(this._launchTarget.x, this._launchTarget.y);
        }
        if (this._returnAtMs >= 0 && this._ageMs >= this._returnAtMs)
            this._returning = true;
        if (this._returning && this._returnTarget) {
            if (this._returnTarget.active === false
                || Phaser.Math.Distance.Between(this.x, this.y, this._returnTarget.x, this._returnTarget.y) < Bullet.CATCH_DISTANCE) {
                this.disable();
                return;
            }
            this.flyTo(this._returnTarget.x, this._returnTarget.y);
        }

        // Bullets can fly in any direction: recycle them when they leave the screen on any side
        const camera = this.scene.cameras.main;
        if (this.x < -this.displayWidth || this.x > camera.width + this.displayWidth
            || this.y < -this.displayHeight || this.y > camera.height + this.displayHeight) {
            this.disable();
        }
    }
}
