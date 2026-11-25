import {Physics, Time} from "phaser";
import Entity from './Entity.ts';
import Health from "../components/Health.ts";
import SpreadWeapon from "../components/SpreadWeapon.ts";
import EnemyMovement from "../components/movement/EnemyMovement.ts";
import createEnemyMovement from "../components/movement/createEnemyMovement.ts";
import {toBulletData} from "../gameData/BulletData.ts";
import type {EnemyData} from "../gameData/EnemyData.ts";

/**
 * Every enemy type is this class configured by an entry of enemies.json.
 */
export default class Enemy extends Entity {
    /** Emitted on the scene events with the enemy, when it dies (not when it leaves the screen) */
    public static readonly KILLED_EVENT: string = 'enemyKilled';

    private static readonly SHOOT_ANIMATION_KEY: string = 'ufoShoot';
    private static readonly HIT_FLASH_MS: number = 50;
    private static readonly HIT_SLOW_FACTOR: number = 0.5;

    private _type: string;
    private _data: EnemyData;
    private _tint: number | null;
    private _target: Entity | null;
    private _movement: EnemyMovement;
    private _shootTimer: Time.TimerEvent | null = null;

    public get enemyType(): string {
        return this._type;
    }

    public get enemyData(): EnemyData {
        return this._data;
    }

    /** What aimed weapons and chasing movements go after, usually the player */
    public get target(): Entity | null {
        return this._target;
    }

    public init(type: string, data: EnemyData, bulletsGroup: Physics.Arcade.Group, target: Entity | null) {
        this._type = type;
        this._data = data;
        this._target = target;
        this._tint = data.tint ? Phaser.Display.Color.HexStringToColor(data.tint).color : null;

        this.setTexture('sprites', data.texture);
        this.setScale(data.scale);
        this.restoreDefaultTint();
        this.angle = 90;

        this.addComponent(new Health(data.health, this));
        this._movement = createEnemyMovement(data.movement);
        this.addComponent(this._movement);

        if (data.weapon) {
            this.addComponent(new SpreadWeapon(bulletsGroup, toBulletData(data.weapon.bullet),
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
                this.restoreDefaultTint();

                if (health.current == 0)
                    this.disable();
            });
        });
        health.on(Health.DEATH_EVENT, () => this.scene.events.emit(Enemy.KILLED_EVENT, this));

        if (data.shootAnimation && !this.scene.anims.exists(Enemy.SHOOT_ANIMATION_KEY)) {
            this.scene.anims.create({
                key: Enemy.SHOOT_ANIMATION_KEY,
                frames: [
                    {key: 'sprites', frame: 'ufoRed'},
                    {key: 'sprites', frame: 'ufoRed-shoot0'},
                    {key: 'sprites', frame: 'ufoRed-shoot1'}
                ],
                frameRate: 4,
            });
        }

        const radius = Math.min(this.width, this.height) / 2;
        this.arcadeBody.setCircle(radius, (this.width - radius * 2) / 2, (this.height - radius * 2) / 2);
    }

    /**
     * @param difficulty multiplies health and fire rate
     */
    public enable(x: number, y: number, difficulty: number = 1) {
        this.enableBody(true, x, y - this.displayHeight, true, true);
        this.setTexture('sprites', this._data.texture);
        this.restoreDefaultTint();

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

    public disable() {
        this.stop();
        this.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE);

        this.disableBody(true, true);
        if (this._shootTimer)
            this._shootTimer.paused = true;
    }

    private restoreDefaultTint() {
        if (this._tint === null)
            this.clearTint();
        else
            this.setTint(this._tint);
    }

    private shoot() {
        if (!this._data.shootAnimation) {
            this.fire();
            return;
        }

        this.play(Enemy.SHOOT_ANIMATION_KEY);
        this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            this.setTexture('sprites', this._data.texture);
            this.fire();
        });
    }

    private fire() {
        let angleOffset = 0;
        if (this._data.weapon?.aimed && this._target?.active) {
            const angleToTarget = Phaser.Math.Angle.Between(this.x, this.y, this._target.x, this._target.y);
            angleOffset = angleToTarget - this.rotation;
        }

        this.getComponent(SpreadWeapon)?.shoot(this, angleOffset);
        this.scene.sound.play('sfx_laser2');
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime);

        // Recycle enemies that left the screen
        const camera = this.scene.cameras.main;
        if (this.y > camera.height + this.displayHeight
            || this.x < -this.displayWidth || this.x > camera.width + this.displayWidth) {
            this.disable();
            return;
        }

        const speed = this._data.speed * (this.tintFill ? Enemy.HIT_SLOW_FACTOR : 1);
        this._movement.update(this, deltaTime, speed);
    }
}
