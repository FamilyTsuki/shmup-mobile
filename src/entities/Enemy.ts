import {Physics, Time} from "phaser";
import Entity from './Entity.ts';
import Health from "../components/Health.ts";
import SpreadWeapon from "../components/SpreadWeapon.ts";
import EnemyMovement from "../components/movement/EnemyMovement.ts";
import createEnemyMovement from "../components/movement/createEnemyMovement.ts";
import {BulletData, toBulletData} from "../gameData/BulletData.ts";
import {bulletSpeedFactor, EnemyData} from "../gameData/EnemyData.ts";
import type {Polarity} from "../gameData/PolarityData.ts";
import TextureFactory from "../utils/TextureFactory.ts";

/**
 * Every enemy type is this class configured by an entry of enemies.json. The polarity is chosen at each spawn.
 */
export default class Enemy extends Entity {
    /** Emitted on the scene events with the enemy, when it dies (not when it leaves the screen) */
    public static readonly KILLED_EVENT: string = 'enemyKilled';
    /** Emitted on the scene events with the enemy, when it releases the enemies of its summon data */
    public static readonly SUMMON_EVENT: string = 'enemySummon';

    private static readonly HIT_FLASH_MS: number = 50;
    private static readonly HIT_SLOW_FACTOR: number = 0.5;
    private static readonly TELEGRAPH_SCALE: number = 1.2;
    private static readonly RESPAWN_MARGIN: number = 100;
    /** Blinks this long before a polarity flip, so the player sees it coming */
    private static readonly FLIP_WARNING_MS: number = 450;
    private static readonly DEFLECT_TINT: number = 0x9a93ab;

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
    private _difficulty: number = 1;
    /** Time since the last polarity flip, for enemies that change color */
    private _flipElapsed: number = 0;
    private _summonElapsed: number = 0;
    private _flipWarning: Phaser.Tweens.Tween | null = null;

    public get enemyType(): string {
        return this._type;
    }

    public get enemyData(): EnemyData {
        return this._data;
    }

    public get polarity(): Polarity {
        return this._polarity;
    }

    /** Health and fire rate multiplier it was spawned with: its split parts get the same */
    public get difficulty(): number {
        return this._difficulty;
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
            if (data.hazard)
                this._bulletData.hazard = true;
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
        this._difficulty = difficulty;
        this.setPolarity(polarity);
        this.setAlpha(1);
        this._flipElapsed = 0;
        this._summonElapsed = 0;
        this.angle = 90;
        this.setScale(this._data.scale);
        this.enableBody(true, x, y - this.displayHeight, true, true);
        this.clearTint();

        // Restore health, in case the enemy is reused from the pool, without emitting events
        this.getComponent(Health)?.reset(Math.ceil(this._data.health * difficulty));
        this._movement.reset(this);

        const weapon = this._data.weapon;
        if (weapon && this._bulletData)
            this._bulletData.speed = Math.round(weapon.bullet.speed * bulletSpeedFactor(difficulty));
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
        this._flipWarning?.stop();
        this._flipWarning = null;

        this.disableBody(true, true);
        if (this._shootTimer)
            this._shootTimer.paused = true;
    }

    /** A shot of its own color hit the shield: a grey flash, no damage */
    public deflect() {
        this.setTint(Enemy.DEFLECT_TINT);
        this.scene.time.delayedCall(Enemy.HIT_FLASH_MS, () => {
            if (!this.tintFill)
                this.clearTint();
        });
    }

    /** Blinks, then flips to the other color */
    private warnFlip() {
        if (!this.active)
            return;
        this._flipWarning?.stop();
        this._flipWarning = this.scene.tweens.add({
            targets: this, alpha: 0.35, duration: Enemy.FLIP_WARNING_MS / 6, yoyo: true, repeat: 2,
            onComplete: () => {
                this._flipWarning = null;
                this.setAlpha(1);
                if (this.active)
                    this.setPolarity(this._polarity === 'ion' ? 'plasma' : 'ion');
            }
        });
    }

    private setPolarity(polarity: Polarity) {
        this._polarity = polarity;
        this.setTexture(TextureFactory.shipKey(this._data.texture, this._data.hazard ? 'hazard' : polarity));
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

        const bullets = this.getComponent(SpreadWeapon)?.shoot(this, angleOffset) ?? [];
        const homing = this._data.weapon?.homing;
        if (homing && target?.active)
            bullets.forEach(bullet => bullet.home(target, homing.turnDegPerSec, homing.homingMs));
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

        const cycle = this._data.polarityCycleMs;
        if (cycle) {
            this._flipElapsed += deltaTime;
            if (this._flipElapsed >= cycle) {
                this._flipElapsed = 0;
                this.warnFlip();
            }
        }

        if (this.scared)
            return;

        if (this._data.spinDegPerSec)
            this.angle += this._data.spinDegPerSec * deltaTime / 1000;
        const summon = this._data.summon;
        if (summon) {
            this._summonElapsed += deltaTime;
            if (this._summonElapsed >= summon.everyMs && this.y > 0) {
                this._summonElapsed = 0;
                this.scene.events.emit(Enemy.SUMMON_EVENT, this);
            }
        }

        const ghostSlow = this.scene.time.now < this._slowedUntil ? this._slowFactor : 1;
        const speed = this._data.speed * (this.tintFill ? Enemy.HIT_SLOW_FACTOR : 1) * ghostSlow;
        this._movement.update(this, deltaTime, speed);
    }
}
