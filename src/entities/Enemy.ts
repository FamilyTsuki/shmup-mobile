import {Physics, Time} from "phaser";
import Entity from './Entity.ts';
import Health from "../components/Health.ts";
import SpreadWeapon from "../components/SpreadWeapon.ts";
import EnemyMovement from "../components/movement/EnemyMovement.ts";
import createEnemyMovement from "../components/movement/createEnemyMovement.ts";
import {BulletData, toBulletData} from "../gameData/BulletData.ts";
import type {EnemyData} from "../gameData/EnemyData.ts";
import type {Polarity} from "../gameData/PolarityData.ts";
import TextureFactory from "../utils/TextureFactory.ts";

/**
 * Every enemy type is this class configured by an entry of enemies.json. The polarity is chosen at each spawn.
 */
export default class Enemy extends Entity {
    /** Emitted on the scene events with the enemy, when it dies (not when it leaves the screen) */
    public static readonly KILLED_EVENT: string = 'enemyKilled';

    private static readonly HIT_FLASH_MS: number = 50;
    private static readonly HIT_SLOW_FACTOR: number = 0.5;
    private static readonly TELEGRAPH_SCALE: number = 1.2;
    private static readonly RESPAWN_MARGIN: number = 100;

    private _type: string;
    private _data: EnemyData;
    private _polarity: Polarity = 'ion';
    private _bulletData: BulletData | null = null;
    private _findTarget: (enemy: Enemy) => Entity | null = () => null;
    private _movement: EnemyMovement;
    private _shootTimer: Time.TimerEvent | null = null;
    private _telegraph: Phaser.Tweens.Tween | null = null;
    private _slowedUntil: number = 0;
    private _slowFactor: number = 1;
    private _scaredUntil: number = 0;

    public get enemyType(): string {
        return this._type;
    }

    public get enemyData(): EnemyData {
        return this._data;
    }

    public get polarity(): Polarity {
        return this._polarity;
    }

    /** What aimed weapons and chasing movements go after: the closest player still alive */
    public get target(): Entity | null {
        return this._findTarget(this);
    }

    public init(type: string, data: EnemyData, bulletsGroup: Physics.Arcade.Group,
                findTarget: (enemy: Enemy) => Entity | null) {
        this._type = type;
        this._data = data;
        this._findTarget = findTarget;

        this.setPolarity('ion');
        this.setScale(data.scale);
        this.angle = 90;

        this.addComponent(new Health(data.health, this));
        this._movement = createEnemyMovement(data.movement);
        this.addComponent(this._movement);

        if (data.weapon) {
            // Shared with the weapon: changing its polarity recolors the next shots
            this._bulletData = toBulletData(data.weapon.bullet, this._polarity);
            this.addComponent(new SpreadWeapon(bulletsGroup, this._bulletData,
                data.weapon.bulletCount, data.weapon.spreadAngleDeg));
            this._shootTimer = this.scene.time.addEvent({delay: data.weapon.fireDelayMs[1], paused: true});
        }

        // Listen once per enemy, not on every enable(): pooled enemies are reused many times
        const health = this.getComponent(Health)!;
        health.on(Health.CHANGE_EVENT, () => {
            this.setTintFill(0xffffff);

            if (health.current == 0)
                this.disableBody();

            this.scene.time.delayedCall(Enemy.HIT_FLASH_MS, () => {
                this.clearTint();

                if (health.current == 0)
                    this.disable();
            });
        });
        health.on(Health.DEATH_EVENT, () => this.scene.events.emit(Enemy.KILLED_EVENT, this));
    }

    /**
     * @param difficulty multiplies health and fire rate
     */
    public enable(x: number, y: number, difficulty: number = 1, polarity: Polarity = 'ion') {
        this.setPolarity(polarity);
        this.setScale(this._data.scale);
        this.enableBody(true, x, y - this.displayHeight, true, true);
        this.clearTint();

        // Restore health, in case the enemy is reused from the pool, without emitting events
        this.getComponent(Health)?.reset(Math.ceil(this._data.health * difficulty));
        this._movement.reset(this);

        const weapon = this._data.weapon;
        if (weapon && this._shootTimer) {
            this._shootTimer.reset({
                delay: Phaser.Math.Between(weapon.fireDelayMs[0], weapon.fireDelayMs[1]) / difficulty,
                callback: this.shoot,
                callbackScope: this,
                loop: true
            });
        }
    }

    /** Coop ghost nearby: moves slower for a moment */
    public slow(factor: number, durationMs: number) {
        this._slowFactor = factor;
        this._slowedUntil = this.scene.time.now + durationMs;
    }

    /** Coop ghost "boo": backs off, shakes and holds its fire for a while */
    public scare(durationMs: number, pushPx: number) {
        this._scaredUntil = this.scene.time.now + durationMs;
        this._telegraph?.stop();
        this._telegraph = null;
        this.setScale(this._data.scale);
        this.scene.tweens.add({targets: this, y: this.y - pushPx, duration: 300, ease: 'Back.easeOut'});
        this.scene.tweens.add({targets: this, angle: {from: 80, to: 100}, duration: 70, yoyo: true,
            repeat: Math.floor(durationMs / 140), onComplete: () => this.angle = 90});
    }

    private get scared(): boolean {
        return this.scene.time.now < this._scaredUntil;
    }

    public disable() {
        this._telegraph?.stop();
        this._telegraph = null;

        this.disableBody(true, true);
        if (this._shootTimer)
            this._shootTimer.paused = true;
    }

    private setPolarity(polarity: Polarity) {
        this._polarity = polarity;
        this.setTexture(TextureFactory.shipKey(this._data.texture, polarity));
        if (this._bulletData)
            this._bulletData.polarity = polarity;

        const radius = TextureFactory.bodyData(this.scene, this.texture.key).hitRadius;
        this.arcadeBody.setCircle(radius, this.width / 2 - radius, this.height / 2 - radius);
    }

    /** Swells before firing: the shot is readable, and the player has time to pick the right polarity */
    private shoot() {
        if (this.scared)
            return;
        if (this._data.telegraphMs <= 0) {
            this.fire();
            return;
        }

        this._telegraph?.stop();
        this._telegraph = this.scene.tweens.add({
            targets: this,
            scale: this._data.scale * Enemy.TELEGRAPH_SCALE,
            duration: this._data.telegraphMs / 2,
            yoyo: true,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this._telegraph = null;
                this.setScale(this._data.scale);
                if (this.active)
                    this.fire();
            }
        });
    }

    private fire() {
        let angleOffset = 0;
        const target = this.target;
        if (this._data.weapon?.aimed && target?.active) {
            const angleToTarget = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
            angleOffset = angleToTarget - this.rotation;
        }

        this.getComponent(SpreadWeapon)?.shoot(this, angleOffset);
        this.scene.sound.play('sfx_laser2', {volume: 0.35});
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime);

        // An enemy that gets past the player comes back from the top: a wave only ends once every enemy is
        // destroyed, so the player has to move and hunt them instead of waiting
        const camera = this.scene.cameras.main;
        if (this.y > camera.height + this.displayHeight) {
            this.y = -this.displayHeight;
            this.x = Phaser.Math.Between(Enemy.RESPAWN_MARGIN, camera.width - Enemy.RESPAWN_MARGIN);
            this._movement.reset(this);
            return;
        }
        if (this.x < -this.displayWidth || this.x > camera.width + this.displayWidth) {
            this.disable();
            return;
        }

        if (this.scared)
            return;
        const ghostSlow = this.scene.time.now < this._slowedUntil ? this._slowFactor : 1;
        const speed = this._data.speed * (this.tintFill ? Enemy.HIT_SLOW_FACTOR : 1) * ghostSlow;
        this._movement.update(this, deltaTime, speed);
    }
}
