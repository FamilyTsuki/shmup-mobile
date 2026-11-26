import {Physics, Scene, Time} from "phaser";
import Entity from "./Entity.ts";
import Bullet from "./Bullet.ts";
import Health from "../components/Health.ts";
import SpreadWeapon from "../components/SpreadWeapon.ts";
import {BulletData, toBulletData} from "../gameData/BulletData.ts";
import type {BossData, BossOriginKey, BossPatternData, BossPhaseData, PatternPolarity} from "../gameData/BossData.ts";
import {oppositePolarity, Polarity, POLARITY_STYLES, resolvePolarity} from "../gameData/PolarityData.ts";
import TextureFactory from "../utils/TextureFactory.ts";

type BossState = 'entering' | 'talking' | 'fighting' | 'dead';

/** What a boss aims at: the player, read for its position and polarity */
type BossTarget = Entity & { polarity: Polarity };

/**
 * Enters from the top, says its lines, then moves and runs the patterns of its current phase.
 * Phases change when health drops below their threshold. Its hull has a polarity, that some phases flip over time.
 */
export default class Boss extends Entity {
    /** Emitted on the scene events when the boss dies */
    public static readonly DEFEATED_EVENT: string = 'bossDefeated';
    /** (phaseIndex: number) emitted on the scene events */
    public static readonly PHASE_CHANGED_EVENT: string = 'bossPhaseChanged';
    /** (enemyType: string, x: number, y: number, polarity: Polarity) emitted on the scene events */
    public static readonly SUMMON_EVENT: string = 'bossSummon';
    /** (polarity: Polarity) emitted on the scene events when the hull changes polarity */
    public static readonly POLARITY_CHANGED_EVENT: string = 'bossPolarityChanged';
    /** (speaker: string, lines: string[], lineMs: number) emitted on the scene events */
    public static readonly SPEAK_EVENT: string = 'bossSpeak';

    /** Time each dialogue line stays on screen */
    public static readonly LINE_MS: number = 2300;

    private static readonly ENTRY_SPEED: number = 0.15;
    private static readonly HIT_FLASH_MS: number = 40;
    private static readonly PHASE_PAUSE_MS: number = 900;
    private static readonly DEATH_EXPLOSIONS: number = 10;
    private static readonly JUMP_MS: number = 260;
    private static readonly SCREEN_MARGIN: number = 160;
    /** Lowest point of a lunge, above the bottom of the screen */
    private static readonly LUNGE_BOTTOM_MARGIN: number = 150;
    /** Traps are never placed this close to the player */
    private static readonly TRAP_SAFE_DISTANCE: number = 260;

    private readonly _data: BossData;
    private readonly _hasCustomTexture: boolean;
    private readonly _bullets: Physics.Arcade.Group;
    /** A living player, picked again for each attack */
    private readonly _findTarget: () => BossTarget | null;
    private _state: BossState = 'entering';
    private _phaseIndex: number = 0;
    private _polarity: Polarity;
    private _patternTimers: Time.TimerEvent[] = [];
    private _swayTime: number = 0;
    private _nextJumpMs: number = 0;
    /** True while a lunge or a jump tween moves the boss */
    private _busy: boolean = false;
    private _introTimer: Time.TimerEvent | null = null;

    /** Saying its intro lines, before the fight */
    public get isTalking(): boolean {
        return this._state === 'talking';
    }

    public get bossData(): BossData {
        return this._data;
    }

    public get polarity(): Polarity {
        return this._polarity;
    }

    public get healthRatio(): number {
        const health = this.getComponent(Health)!;
        return health.current / health.max;
    }

    constructor(scene: Scene, data: BossData, bullets: Physics.Arcade.Group, findTarget: () => BossTarget | null,
                difficulty: number) {
        const hasCustomTexture = scene.textures.exists(data.texture);
        super(scene, scene.cameras.main.centerX, 0,
            hasCustomTexture ? data.texture : TextureFactory.shipKey(data.texture, data.phases[0].polarity));

        this._data = data;
        this._hasCustomTexture = hasCustomTexture;
        this._bullets = bullets;
        this._findTarget = findTarget;
        this._polarity = data.phases[0].polarity;

        this.setScale(data.scale);
        this.angle = data.upright ? 0 : 90;
        this.y = -this.displayHeight / 2;

        const radius = hasCustomTexture
            ? Math.min(this.width, this.height) * 0.36
            : TextureFactory.bodyData(scene, this.texture.key).hitRadius;
        this.arcadeBody.setCircle(radius, this.width / 2 - radius, this.height / 2 - radius);

        const health = new Health(Math.round(data.health * difficulty), this);
        // Invulnerable until it reaches its position and finishes talking
        health.enabled = false;
        this.addComponent(health);

        health.on(Health.CHANGE_EVENT, this.onHealthChanged, this);
        health.on(Health.DEATH_EVENT, this.die, this);
    }

    private onHealthChanged() {
        this.setTintFill(0xffffff);
        this.scene.time.delayedCall(Boss.HIT_FLASH_MS, () => this.clearTint());

        const nextPhase = this._data.phases[this._phaseIndex + 1];
        if (nextPhase && this.healthRatio <= nextPhase.healthBelow && this.healthRatio > 0)
            this.startPhase(this._phaseIndex + 1);
    }

    private speak(lines: string[]) {
        this.scene.events.emit(Boss.SPEAK_EVENT, this._data.name, lines, Boss.LINE_MS);
    }

    private startFight() {
        const intro = this._data.intro ?? [];
        if (intro.length === 0) {
            this.beginPhases();
            return;
        }

        this._state = 'talking';
        this.speak(intro);
        this._introTimer = this.scene.time.delayedCall(intro.length * Boss.LINE_MS, () => this.beginPhases());
    }

    /** Cuts the intro lines short and starts fighting right away */
    public skipIntro() {
        if (this._state !== 'talking')
            return;
        this._introTimer?.remove();
        this.beginPhases();
    }

    private beginPhases() {
        if (this._state === 'dead')
            return;
        this._state = 'fighting';
        this.getComponent(Health)!.enabled = true;
        this.startPhase(0);
    }

    private setPolarity(polarity: Polarity) {
        this._polarity = polarity;
        if (!this._hasCustomTexture)
            this.setTexture(TextureFactory.shipKey(this._data.texture, polarity));
        this.scene.events.emit(Boss.POLARITY_CHANGED_EVENT, polarity);

        // A ring announces the flip
        const ring = this.scene.add.image(this.x, this.y, TextureFactory.RING_KEY)
            .setTint(POLARITY_STYLES[polarity].color).setDepth(40);
        this.scene.tweens.add({
            targets: ring, scale: {from: 0.8, to: 3.2}, alpha: {from: 1, to: 0}, duration: 450,
            onComplete: () => ring.destroy()
        });
    }

    private startPhase(index: number) {
        this._phaseIndex = index;
        this.stopPatterns();
        this.scene.events.emit(Boss.PHASE_CHANGED_EVENT, index);

        const phase: BossPhaseData = this._data.phases[index];
        this.setPolarity(phase.polarity);
        if (phase.say)
            this.speak([phase.say]);

        // A short breather so the player sees the phase change before the new patterns
        this.scene.time.delayedCall(index === 0 ? 0 : Boss.PHASE_PAUSE_MS, () => {
            if (this._state !== 'fighting' || this._phaseIndex !== index)
                return;

            this._patternTimers = phase.patterns.map(pattern => this.startPattern(pattern));
            if (phase.polarityCycleMs) {
                this._patternTimers.push(this.scene.time.addEvent({
                    delay: phase.polarityCycleMs,
                    loop: true,
                    callback: () => this.setPolarity(oppositePolarity(this._polarity))
                }));
            }
        });
    }

    private resolvePatternPolarity(rule: PatternPolarity | undefined, shot: number): Polarity {
        if (rule === undefined)
            return this._polarity;
        if (rule === 'counter') {
            const target = this._findTarget();
            return target ? oppositePolarity(target.polarity) : this._polarity;
        }
        return resolvePolarity(rule, shot);
    }

    private startPattern(pattern: BossPatternData): Time.TimerEvent {
        let shots = 0;
        let fire: () => void;

        switch (pattern.type) {
            case 'summon':
                fire = () => {
                    for (let i = 0; i < pattern.count; i++) {
                        this.scene.events.emit(Boss.SUMMON_EVENT, pattern.enemy,
                            this.x + (i - (pattern.count - 1) / 2) * 160, 0, resolvePolarity('alternate', i));
                    }
                };
                break;
            case 'fan': {
                const bulletData = toBulletData(pattern.bullet, this._polarity);
                const weapon = new SpreadWeapon(this._bullets, bulletData, pattern.bulletCount, pattern.spreadAngleDeg);
                let rotationDeg = 0;
                fire = () => {
                    const baseRotation = this._data.upright ? Math.PI / 2 : this.rotation;
                    const target = this._findTarget();
                    bulletData.polarity = this.resolvePatternPolarity(pattern.polarity, shots);

                    for (const pt of this.resolveOrigins(pattern.origin)) {
                        let angleOffset = Phaser.Math.DegToRad(rotationDeg);
                        if (pattern.aimed && target)
                            angleOffset += Phaser.Math.Angle.Between(pt.x, pt.y, target.x, target.y) - baseRotation;

                        const spawnPoint = (pattern.origin || this._data.upright)
                            ? {x: pt.x, y: pt.y, rotation: baseRotation}
                            : undefined;
                        weapon.shoot(this, angleOffset, spawnPoint);
                    }
                    rotationDeg += pattern.rotateDegPerShot ?? 0;
                };
                break;
            }
            case 'curtain':
                fire = () => this.fireCurtain(pattern, this.resolvePatternPolarity(pattern.polarity, shots));
                break;
            case 'ring':
                fire = () => this.fireRing(pattern, this.resolvePatternPolarity(pattern.polarity, shots));
                break;
            case 'lunge':
                fire = () => this.lunge(pattern.warnMs, pattern.speed);
                break;
            case 'boomerang':
                fire = () => {
                    const target = this._findTarget();
                    if (!target)
                        return;
                    const data = toBulletData(pattern.bullet, this.resolvePatternPolarity(pattern.polarity, shots));
                    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
                    this.spawnBullet(this.x, this.y, angle, data)?.returnAfter(pattern.returnAfterMs, this);
                };
                break;
            case 'traps':
                fire = () => this.fireTraps(pattern, this.resolvePatternPolarity(pattern.polarity, shots));
                break;
        }

        return this.scene.time.addEvent({
            delay: pattern.delayMs,
            loop: true,
            callback: () => {
                if (this._state !== 'fighting')
                    return;
                fire();
                shots++;
            }
        });
    }

    private resolveOrigins(origin?: BossOriginKey): { x: number; y: number }[] {
        const origins = this._data.origins;
        if (!origin || !origins)
            return [{x: this.x, y: this.y}];

        const toWorld = (off?: { x: number; y: number }) => off
            ? {x: this.x + off.x * this.displayWidth, y: this.y + off.y * this.displayHeight}
            : {x: this.x, y: this.y};

        if (origin === 'hands')
            return [toWorld(origins.leftHand), toWorld(origins.rightHand)];

        return [toWorld(origins[origin])];
    }

    private spawnBullet(x: number, y: number, angle: number, data: BulletData): Bullet | null {
        const bullet = this._bullets.get() as Bullet | null;
        bullet?.enable(x, y, Math.cos(angle) * data.speed, Math.sin(angle) * data.speed, data);
        return bullet;
    }

    /** A falling row with one gap, never right where the gap was last time */
    private fireCurtain(pattern: Extract<BossPatternData, { type: 'curtain' }>, polarity: Polarity) {
        const width = this.scene.cameras.main.width;
        const data = toBulletData(pattern.bullet, polarity);
        const gapCenter = Phaser.Math.Between(pattern.gapWidth / 2 + 40, width - pattern.gapWidth / 2 - 40);
        for (let x = pattern.spacing / 2; x < width; x += pattern.spacing) {
            if (Math.abs(x - gapCenter) < pattern.gapWidth / 2)
                continue;
            this.spawnBullet(x, 0, Math.PI / 2, data);
        }
    }

    /** Closes in on where the player was when the ring appeared: moving out of it is the way out */
    private fireRing(pattern: Extract<BossPatternData, { type: 'ring' }>, polarity: Polarity) {
        const target = this._findTarget();
        if (!target)
            return;
        const data = toBulletData(pattern.bullet, polarity);
        const centerX = target.x;
        const centerY = target.y;
        for (let i = 0; i < pattern.bulletCount; i++) {
            const angle = i * Math.PI * 2 / pattern.bulletCount;
            const x = centerX + Math.cos(angle) * pattern.radius;
            const y = centerY + Math.sin(angle) * pattern.radius;
            this.spawnBullet(x, y, angle + Math.PI, data)?.holdThenLaunch(pattern.holdMs, {x: centerX, y: centerY});
        }
    }

    private fireTraps(pattern: Extract<BossPatternData, { type: 'traps' }>, polarity: Polarity) {
        const {width, height} = this.scene.cameras.main;
        const data = toBulletData(pattern.bullet, polarity);
        const target = this._findTarget();
        for (let i = 0, placed = 0; placed < pattern.count && i < pattern.count * 10; i++) {
            const x = Phaser.Math.Between(80, width - 80);
            const y = Phaser.Math.Between(height * 0.35, height - 120);
            if (target && Phaser.Math.Distance.Between(x, y, target.x, target.y) < Boss.TRAP_SAFE_DISTANCE)
                continue;
            const trap = this.spawnBullet(x, y, 0, data);
            trap?.holdThenLaunch(pattern.lifetimeMs, {x, y});
            trap?.expireAfter(pattern.lifetimeMs);
            // Pops in so the player sees it appear
            if (trap) {
                const scale = trap.scale;
                this.scene.tweens.add({targets: trap, scale: {from: 0, to: scale}, duration: 200, ease: 'Back.easeOut'});
            }
            placed++;
        }
    }

    /** Flashes as a warning, dives at the player column, then goes back up */
    private lunge(warnMs: number, speed: number) {
        const target = this._findTarget();
        if (this._busy || !target)
            return;
        this._busy = true;

        const startX = this.x;
        const startY = this.y;
        this.scene.tweens.add({
            targets: this, alpha: 0.4, duration: warnMs / 6, yoyo: true, repeat: 2,
            onComplete: () => {
                if (this._state !== 'fighting') {
                    this._busy = false;
                    return;
                }
                const targetX = target.x;
                const targetY = this.scene.cameras.main.height - Boss.LUNGE_BOTTOM_MARGIN;
                const distance = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
                this.scene.tweens.chain({
                    targets: this,
                    tweens: [
                        {x: targetX, y: targetY, duration: distance / speed, ease: 'Quad.easeIn'},
                        {x: startX, y: startY, duration: distance / speed * 2, ease: 'Quad.easeOut', delay: 200},
                    ],
                    onComplete: () => this._busy = false,
                });
            }
        });
    }

    private jump() {
        const camera = this.scene.cameras.main;
        const amplitude = this._data.moveAmplitude;
        const x = Phaser.Math.Clamp(this.x + Phaser.Math.Between(-amplitude, amplitude),
            Boss.SCREEN_MARGIN, camera.width - Boss.SCREEN_MARGIN);
        const y = this._data.entryY + Phaser.Math.Between(-120, 120);
        this._busy = true;
        this.scene.tweens.add({
            targets: this, x, y, duration: Boss.JUMP_MS, ease: 'Cubic.easeOut',
            onComplete: () => this._busy = false
        });
    }

    private stopPatterns() {
        this._patternTimers.forEach(timer => timer.remove());
        this._patternTimers = [];
    }

    private die() {
        this._state = 'dead';
        this.stopPatterns();
        this.scene.tweens.killTweensOf(this);
        this.setAlpha(1);
        this.arcadeBody.setEnable(false);
        if (this._data.defeatLine)
            this.speak([this._data.defeatLine]);

        // A chain of explosions over the hull, in both colors, before it disappears
        for (let i = 0; i < Boss.DEATH_EXPLOSIONS; i++) {
            this.scene.time.delayedCall(i * 110, () => {
                const color = POLARITY_STYLES[i % 2 === 0 ? 'ion' : 'plasma'].color;
                const explosion = this.scene.add.image(
                    this.x + Phaser.Math.Between(-this.displayWidth / 3, this.displayWidth / 3),
                    this.y + Phaser.Math.Between(-this.displayHeight / 3, this.displayHeight / 3),
                    TextureFactory.RING_KEY).setTint(color).setDepth(40);
                this.scene.tweens.add({
                    targets: explosion, scale: {from: 0.3, to: 1.6}, alpha: {from: 1, to: 0}, duration: 600,
                    onComplete: () => explosion.destroy()
                });
            });
        }

        this.scene.cameras.main.shake(800, 0.02);
        this.scene.tweens.add({
            targets: this, alpha: 0, duration: Boss.DEATH_EXPLOSIONS * 110, delay: 600,
            onComplete: () => {
                this.scene.events.emit(Boss.DEFEATED_EVENT, this);
                this.destroy();
            }
        });
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime);

        if (this._state === 'entering') {
            this.y += Boss.ENTRY_SPEED * deltaTime;
            if (this.y >= this._data.entryY) {
                this.y = this._data.entryY;
                this.startFight();
            }
            return;
        }

        if (this._state !== 'fighting' || this._busy)
            return;

        const speedFactor = this._data.phases[this._phaseIndex].moveSpeedFactor;
        if (this._data.movement === 'duelist') {
            this._nextJumpMs -= deltaTime * speedFactor;
            if (this._nextJumpMs <= 0) {
                this._nextJumpMs = this._data.repositionMs ?? 1500;
                this.jump();
            }
            return;
        }

        this._swayTime += deltaTime * speedFactor;
        this.x = this.scene.cameras.main.centerX + Math.sin(this._swayTime * this._data.moveSpeed) * this._data.moveAmplitude;
    }
}
