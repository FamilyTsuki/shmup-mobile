import {Physics, Scene, Time} from "phaser";
import Entity from "./Entity.ts";
import Health from "../components/Health.ts";
import SpreadWeapon from "../components/SpreadWeapon.ts";
import {toBulletData} from "../gameData/BulletData.ts";
import type {BossData, BossPatternData, BossPhaseData} from "../gameData/BossData.ts";

type BossState = 'entering' | 'fighting' | 'dead';

/**
 * Enters from the top, then sways while running the shooting patterns of its current phase.
 * Phases change when health drops below their threshold.
 */
export default class Boss extends Entity {
    /** Emitted on the scene events when the boss dies */
    public static readonly DEFEATED_EVENT: string = 'bossDefeated';
    /** (phaseIndex: number) emitted on the scene events */
    public static readonly PHASE_CHANGED_EVENT: string = 'bossPhaseChanged';
    /** (enemyType: string, x: number, y: number) emitted on the scene events */
    public static readonly SUMMON_EVENT: string = 'bossSummon';

    private static readonly ENTRY_SPEED: number = 0.15;
    private static readonly HIT_FLASH_MS: number = 40;
    private static readonly PHASE_PAUSE_MS: number = 900;
    private static readonly DEATH_EXPLOSIONS: number = 8;

    private readonly _data: BossData;
    private readonly _bullets: Physics.Arcade.Group;
    private readonly _target: Entity;
    private readonly _tint: number | null;
    private _state: BossState = 'entering';
    private _phaseIndex: number = 0;
    private _patternTimers: Time.TimerEvent[] = [];
    private _swayTime: number = 0;

    public get bossData(): BossData {
        return this._data;
    }

    public get healthRatio(): number {
        const health = this.getComponent(Health)!;
        return health.current / health.max;
    }

    constructor(scene: Scene, data: BossData, bullets: Physics.Arcade.Group, target: Entity, difficulty: number) {
        super(scene, scene.cameras.main.centerX, 0, 'sprites', data.texture);

        this._data = data;
        this._bullets = bullets;
        this._target = target;
        this._tint = data.tint ? Phaser.Display.Color.HexStringToColor(data.tint).color : null;

        this.setScale(data.scale);
        this.angle = 90;
        this.y = -this.displayHeight / 2;
        this.restoreTint();

        const radius = Math.min(this.width, this.height) / 2;
        this.arcadeBody.setCircle(radius, (this.width - radius * 2) / 2, (this.height - radius * 2) / 2);

        const health = new Health(Math.round(data.health * difficulty), this);
        // Invulnerable until it reaches its position
        health.enabled = false;
        this.addComponent(health);

        health.on(Health.CHANGE_EVENT, this.onHealthChanged, this);
        health.on(Health.DEATH_EVENT, this.die, this);
    }

    private onHealthChanged() {
        this.setTintFill(0xffffff);
        this.scene.time.delayedCall(Boss.HIT_FLASH_MS, () => this.restoreTint());

        const nextPhase = this._data.phases[this._phaseIndex + 1];
        if (nextPhase && this.healthRatio <= nextPhase.healthBelow && this.healthRatio > 0)
            this.startPhase(this._phaseIndex + 1);
    }

    private startPhase(index: number) {
        this._phaseIndex = index;
        this.stopPatterns();
        this.scene.events.emit(Boss.PHASE_CHANGED_EVENT, index);

        // A short breather so the player sees the phase change before the new patterns
        this.scene.time.delayedCall(index === 0 ? 0 : Boss.PHASE_PAUSE_MS, () => {
            if (this._state !== 'fighting' || this._phaseIndex !== index)
                return;

            const phase: BossPhaseData = this._data.phases[index];
            this._patternTimers = phase.patterns.map(pattern => this.startPattern(pattern));
        });
    }

    private startPattern(pattern: BossPatternData): Time.TimerEvent {
        if (pattern.type === 'summon') {
            return this.scene.time.addEvent({
                delay: pattern.delayMs,
                loop: true,
                callback: () => {
                    for (let i = 0; i < pattern.count; i++)
                        this.scene.events.emit(Boss.SUMMON_EVENT, pattern.enemy, this.x + (i - (pattern.count - 1) / 2) * 160, 0);
                }
            });
        }

        const weapon = new SpreadWeapon(this._bullets, toBulletData(pattern.bullet), pattern.bulletCount,
            pattern.spreadAngleDeg);
        let rotationDeg = 0;

        return this.scene.time.addEvent({
            delay: pattern.delayMs,
            loop: true,
            callback: () => {
                let angleOffset = Phaser.Math.DegToRad(rotationDeg);
                if (pattern.aimed && this._target.active)
                    angleOffset += Phaser.Math.Angle.Between(this.x, this.y, this._target.x, this._target.y) - this.rotation;

                weapon.shoot(this, angleOffset);
                rotationDeg += pattern.rotateDegPerShot ?? 0;
            }
        });
    }

    private stopPatterns() {
        this._patternTimers.forEach(timer => timer.remove());
        this._patternTimers = [];
    }

    private die() {
        this._state = 'dead';
        this.stopPatterns();
        this.arcadeBody.setEnable(false);

        // A chain of explosions over the hull before it disappears
        for (let i = 0; i < Boss.DEATH_EXPLOSIONS; i++) {
            this.scene.time.delayedCall(i * 120, () => {
                const explosion = this.scene.add.image(
                    this.x + Phaser.Math.Between(-this.displayWidth / 3, this.displayWidth / 3),
                    this.y + Phaser.Math.Between(-this.displayHeight / 3, this.displayHeight / 3),
                    'sprites', 'star1').setTint(0xffd166);
                this.scene.tweens.add({
                    targets: explosion, scale: {from: 2, to: 7}, alpha: {from: 1, to: 0}, duration: 600,
                    onComplete: () => explosion.destroy()
                });
            });
        }

        this.scene.cameras.main.shake(800, 0.02);
        this.scene.tweens.add({
            targets: this, alpha: 0, duration: Boss.DEATH_EXPLOSIONS * 120, delay: 200,
            onComplete: () => {
                this.scene.events.emit(Boss.DEFEATED_EVENT, this);
                this.destroy();
            }
        });
    }

    private restoreTint() {
        if (this._tint === null)
            this.clearTint();
        else
            this.setTint(this._tint);
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime);

        if (this._state === 'entering') {
            this.y += Boss.ENTRY_SPEED * deltaTime;
            if (this.y >= this._data.entryY) {
                this.y = this._data.entryY;
                this._state = 'fighting';
                this.getComponent(Health)!.enabled = true;
                this.startPhase(0);
            }
            return;
        }

        if (this._state === 'fighting') {
            this._swayTime += deltaTime * this._data.phases[this._phaseIndex].moveSpeedFactor;
            this.x = this.scene.cameras.main.centerX + Math.sin(this._swayTime * this._data.moveSpeed) * this._data.moveAmplitude;
        }
    }
}
