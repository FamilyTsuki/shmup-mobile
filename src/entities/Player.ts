import {GameObjects, Input, Physics, Scene} from "phaser";
import {PlayerShipData, PlayerShipsData} from "../gameData/PlayerShipsData.ts";
import type {BulletData} from "../gameData/BulletData.ts";
import type {PowerUpsData, PowerUpType} from "../gameData/PowerUpData.ts";
import type {PlayerStats} from "../gameData/UpgradeData.ts";
import {oppositePolarity, Polarity, PolarityData, POLARITY_STYLES} from "../gameData/PolarityData.ts";
import type {IInputSource} from "../input/InputState.ts";
import Entity from './Entity.ts';
import Bullet from "./Bullet.ts";
import Health from "../components/Health.ts";
import Movement from "../components/Movement.ts";
import SpreadWeapon from "../components/SpreadWeapon.ts";
import TextureFactory from "../utils/TextureFactory.ts";
import GameConstants from "../GameConstants.ts";
import CeaseFire from "../managers/CeaseFire.ts";

export default class Player extends Entity {
    /** (player: Player) emitted on the scene events when the player loses health (not when a shield absorbs the hit) */
    public static readonly HIT_EVENT: string = 'playerHit';
    /** (type: PowerUpType, player: Player) emitted on the scene events */
    public static readonly POWER_UP_EVENT: string = 'playerPowerUp';
    /** (x: number, y: number, charge: number, player: Player) emitted on the scene events when a bullet of the same polarity is absorbed */
    public static readonly ABSORB_EVENT: string = 'playerAbsorb';
    /** (polarity: Polarity, releasedCharge: number, player: Player) emitted on the scene events; releasedCharge is 0 without a burst */
    public static readonly POLARITY_SWITCH_EVENT: string = 'playerPolaritySwitch';

    /** (player: Player) emitted on the scene events when a ghost taps: it wants to scare the enemies around */
    public static readonly GHOST_BOO_EVENT: string = 'playerGhostBoo';

    public static readonly MAX_CHARGE: number = 100;
    private static readonly GHOST_BOB_PX: number = 14;
    private static readonly GHOST_BOB_SPEED: number = 0.004;

    private static readonly INVULNERABLE_MS: number = 1200;
    private static readonly SHIELD_BREAK_INVULNERABLE_MS: number = 500;
    private static readonly BLINK_MS: number = 100;
    private static readonly SPREAD_DEG_PER_EXTRA_BULLET: number = 7;
    private static readonly HIT_VIBRATION_MS: number = 120;
    private static readonly SWITCH_VIBRATION_MS: number = 15;
    private static readonly AURA_SCALE: number = 0.62;

    private readonly _bulletData: BulletData = {
        width: 25,
        height: 11,
        speed: 1100,
        damage: 1,
        polarity: 'ion',
        shape: 'bolt'
    };

    private _input: IInputSource;
    private _stats: PlayerStats;
    private _powerUps: PowerUpsData;
    private _polarityData: PolarityData;
    private _weapon: SpreadWeapon;
    private _playerShipData: PlayerShipData;
    private _polarity: Polarity = 'ion';
    private _charge: number = 0;
    private _lastSwitchTime: number = -Infinity;
    private _switchRequested: boolean = false;
    private _lastShotTime: number = 0;
    private _invulnerableUntil: number = 0;
    private _rapidFireUntil: number = 0;
    private _multiShotUntil: number = 0;
    private _shieldHits: number = 0;
    private _shieldSprite: GameObjects.Image;
    private _aura: GameObjects.Image;
    private _trail: GameObjects.Particles.ParticleEmitter;

    /** Coop: room id of the player controlling this ship, 0 for the one playing on this device */
    public peerId: number = 0;
    /** Coop: 0 for P1 */
    public index: number = 0;

    private _ghost: boolean = false;
    private _baseY: number = 0;

    /** Coop: a dead player keeps flying as a ghost, untouchable and unable to shoot, until an ally revives it */
    public get isGhost(): boolean {
        return this._ghost;
    }

    /** Images that follow the ship (aura, shield), drawn with it on coop guests */
    public get followers(): Phaser.GameObjects.Image[] {
        return [this._aura, this._shieldSprite];
    }

    public get lives(): number {
        return this.getComponent(Health)?.current ?? 0;
    }

    public get magnetRadius(): number {
        return this._stats.magnetRadius;
    }

    public get polarity(): Polarity {
        return this._polarity;
    }

    /** Resonance in [0, MAX_CHARGE] */
    public get charge(): number {
        return this._charge;
    }

    /**
     * @param debugKeys 1, 2, 3 switch ship: only for the ship of this device
     */
    constructor(scene: Scene, x: number, y: number, debugKeys: boolean = true) {
        super(scene, x, y, TextureFactory.shipKey('arrow', 'ion'));

        if (debugKeys && this.scene.input.keyboard) {
            this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.ONE).on('down', () => this.selectPlayerShip(1));
            this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.TWO).on('down', () => this.selectPlayerShip(2));
            this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.THREE).on('down', () => this.selectPlayerShip(3));
        }
    }

    public init(bulletsGroup: Physics.Arcade.Group, input: IInputSource, stats: PlayerStats,
                powerUps: PowerUpsData, polarityData: PolarityData, shipId: number) {
        this._input = input;
        this._stats = stats;
        this._powerUps = powerUps;
        this._polarityData = polarityData;
        this._bulletData.damage = stats.damage;
        this._bulletData.owner = this.index;

        this.addComponent(new Health(stats.maxHealth, this));
        this.addComponent(new Movement());
        this._weapon = new SpreadWeapon(bulletsGroup, this._bulletData, stats.bulletCount, 0);
        this.addComponent(this._weapon);

        this.angle = -90;
        this.setDepth(10);

        // Engine flame behind the ship, in the current polarity color
        this._trail = this.scene.add.particles(0, 0, TextureFactory.PARTICLE_KEY, {
            follow: this,
            followOffset: {x: 0, y: 46},
            speedY: {min: 180, max: 320},
            speedX: {min: -30, max: 30},
            scale: {start: 1.4, end: 0.2},
            alpha: {start: 0.8, end: 0},
            lifespan: 260,
            frequency: 18,
            
        }).setDepth(9);

        // Shows the polarity around the ship, brightens when absorbing
        this._aura = this.scene.add.image(this.x, this.y, TextureFactory.RING_KEY)
            .setScale(Player.AURA_SCALE).setAlpha(0.3).setDepth(9);

        this.selectPlayerShip(shipId);
        this.applyPolarity();

        this._shieldSprite = this.scene.add.image(this.x, this.y, TextureFactory.SHIELD_KEY).setVisible(false).setDepth(11);
        this._baseY = this.y;
        // "on": in coop a revived player can die again
        this.getComponent(Health)?.on(Health.DEATH_EVENT, () => {
            this._shieldSprite.setVisible(false);
            this._aura.setVisible(false);
            this._trail.stop();
        });
    }

    public selectPlayerShip(playerShipDataId: number) {
        const playerShipsData = this.scene.cache.json.get(GameConstants.DataKeys.PLAYER_SHIPS) as PlayerShipsData;
        this._playerShipData = playerShipsData[playerShipDataId] ?? playerShipsData[1];

        this.setTexture(TextureFactory.shipKey(this._playerShipData.texture, this._polarity));
        const bodyData = this._playerShipData.body;
        this.arcadeBody.setCircle(bodyData.radius, bodyData.offsetX, bodyData.offsetY);

        this.getComponent(Movement)?.setSpeed(this._playerShipData.movementSpeed);
    }

    /**
     * Every source of damage goes through here: shield and invulnerability frames come first.
     */
    public hit(damage: number) {
        const now = this.scene.time.now;
        if (!this.active || this._ghost || now < this._invulnerableUntil)
            return;

        if (this._shieldHits > 0) {
            this._shieldHits--;
            this._shieldSprite.setVisible(this._shieldHits > 0);
            this.startInvulnerability(Player.SHIELD_BREAK_INVULNERABLE_MS);
            return;
        }

        this.getComponent(Health)?.damage(damage);
        this.scene.events.emit(Player.HIT_EVENT, this);
        navigator.vibrate?.(Player.HIT_VIBRATION_MS);
        this.startInvulnerability(Player.INVULNERABLE_MS);
    }

    /**
     * An enemy bullet touched the ship: absorbed if it has the ship polarity, a hit otherwise.
     * DANGER bullets (orange) always hit.
     */
    public touchBullet(bullet: Bullet) {
        if (!this.active || this._ghost)
            return;

        bullet.disable();
        const overloaded = this._polarityData.overloadAtFullCharge && this._charge >= Player.MAX_CHARGE;
        if (bullet.hazard || bullet.polarity !== this._polarity || overloaded) {
            this.hit(bullet.damage);
            return;
        }

        this._charge = Math.min(Player.MAX_CHARGE, this._charge + this._polarityData.absorbCharge);
        this.scene.tweens.killTweensOf(this._aura);
        this._aura.setAlpha(0.9).setScale(Player.AURA_SCALE * 1.25);
        this.scene.tweens.add({targets: this._aura, alpha: 0.25, scale: Player.AURA_SCALE, duration: 220});
        this.scene.events.emit(Player.ABSORB_EVENT, bullet.x, bullet.y, this._charge, this);
    }

    /**
     * Coop death: the ship stays on screen, see-through, without a body: nothing can touch it.
     */
    public becomeGhost(alpha: number, tint: number) {
        this._ghost = true;
        this._charge = 0;
        this._shieldHits = 0;
        this.disableBody(false, false);
        this.scene.tweens.killTweensOf(this);
        this.setAlpha(alpha).setTint(tint);
    }

    public revive(lives: number, invulnerableMs: number) {
        this._ghost = false;
        this.y = this._baseY;
        this.enableBody(false, this.x, this.y, true, true);
        this.clearTint().setAlpha(1);
        this._aura.setVisible(true);
        this._trail.start();
        this.getComponent(Health)?.heal(lives);
        this.startInvulnerability(invulnerableMs);
    }

    /** Coop high-five: resonance shared between two ships */
    public addCharge(amount: number) {
        this._charge = Phaser.Math.Clamp(this._charge + amount, 0, Player.MAX_CHARGE);
    }

    public setCharge(charge: number) {
        this._charge = Phaser.Math.Clamp(charge, 0, Player.MAX_CHARGE);
    }

    /** Coop: the shots of this ship are drawn see-through on this screen */
    public setShotAlpha(alpha: number) {
        this._bulletData.alpha = alpha;
    }

    /** From the HUD polarity button: applied on the next update */
    public requestPolaritySwitch() {
        this._switchRequested = true;
    }

    public applyPowerUp(type: PowerUpType) {
        const now = this.scene.time.now;
        switch (type) {
            case 'rapidFire':
                this._rapidFireUntil = now + this._powerUps.rapidFire.durationMs;
                break;
            case 'multiShot':
                this._multiShotUntil = now + this._powerUps.multiShot.durationMs;
                break;
            case 'shield':
                this._shieldHits = this._powerUps.shield.hits;
                this._shieldSprite.setVisible(true);
                break;
            case 'heal':
                this.getComponent(Health)?.heal(this._powerUps.heal.amount);
                break;
            case 'bomb':
                // Bomb stock lives in the registry, handled by the game scene
                break;
        }

        this.scene.events.emit(Player.POWER_UP_EVENT, type, this);
    }

    /**
     * Flips the polarity. With enough resonance the whole gauge is released: the game scene turns it into a burst.
     */
    private switchPolarity(now: number) {
        if (now - this._lastSwitchTime < this._polarityData.switchCooldownMs)
            return;
        this._lastSwitchTime = now;

        this._polarity = oppositePolarity(this._polarity);
        this.applyPolarity();
        navigator.vibrate?.(Player.SWITCH_VIBRATION_MS);

        let released = 0;
        if (this._charge >= this._polarityData.burst.minCharge) {
            released = this._charge;
            this._charge = 0;
        }
        this.scene.events.emit(Player.POLARITY_SWITCH_EVENT, this._polarity, released, this);
    }

    private applyPolarity() {
        const color = POLARITY_STYLES[this._polarity].color;
        this.setTexture(TextureFactory.shipKey(this._playerShipData.texture, this._polarity));
        this._bulletData.polarity = this._polarity;
        this._trail.setParticleTint(color);
        this._aura.setTint(color);
    }

    private startInvulnerability(durationMs: number) {
        this._invulnerableUntil = this.scene.time.now + durationMs;
        this.scene.tweens.killTweensOf(this);
        this.scene.tweens.add({
            targets: this,
            alpha: {from: 0.2, to: 1},
            duration: Player.BLINK_MS,
            repeat: Math.floor(durationMs / Player.BLINK_MS / 2),
            yoyo: true,
            onComplete: () => this.setAlpha(1)
        });
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime);

        const inputState = this._input.poll();

        // _baseY is where the ship is; a ghost is drawn bobbing around it
        if (inputState.absoluteX !== undefined) {
            this.x = inputState.absoluteX;
            this._baseY = inputState.absoluteY ?? this._baseY;
        } else if (inputState.rotate !== 0) {
            this.angle += inputState.rotate * this._playerShipData.movementSpeed * deltaTime;
        } else {
            this.getComponent(Movement)?.moveHorizontally(this, inputState.moveX * deltaTime);
            this._baseY += inputState.moveY * this._playerShipData.movementSpeed * deltaTime;
        }
        this.x += inputState.dragX;
        this._baseY += inputState.dragY;

        // Stop player from going offscreen, or over the HUD controls and the enemies' half
        const camera = this.scene.cameras.main;
        const bounds = GameConstants.playerYBounds(camera.height);
        this.x = Phaser.Math.Clamp(this.x, this.displayWidth / 2, camera.width - this.displayWidth / 2);
        this._baseY = Phaser.Math.Clamp(this._baseY, bounds.min, bounds.max);
        this.y = this._baseY;
        this._shieldSprite.setPosition(this.x, this.y);
        this._aura.setPosition(this.x, this.y);

        const tapped = inputState.switchPolarity || this._switchRequested;
        this._switchRequested = false;

        // A ghost floats around, and its tap scares enemies instead of switching polarity
        if (this._ghost) {
            this.y = this._baseY + Math.sin(timeSinceLaunch * Player.GHOST_BOB_SPEED) * Player.GHOST_BOB_PX;
            if (tapped)
                this.scene.events.emit(Player.GHOST_BOO_EVENT, this);
            return;
        }

        if (tapped)
            this.switchPolarity(timeSinceLaunch);
        if (inputState.fire)
            this.tryShoot(timeSinceLaunch);
    }

    private tryShoot(now: number) {
        if (CeaseFire.isActive(this.scene))
            return;
        const rapidFire = now < this._rapidFireUntil;
        const fireDelay = this._stats.fireDelayMs / (rapidFire ? this._powerUps.rapidFire.fireRateMultiplier : 1);
        if (now - this._lastShotTime < fireDelay)
            return;

        const multiShot = now < this._multiShotUntil;
        const bulletCount = this._stats.bulletCount + (multiShot ? this._powerUps.multiShot.extraBullets : 0);
        this._weapon.setPattern(bulletCount, (bulletCount - 1) * Player.SPREAD_DEG_PER_EXTRA_BULLET);
        this._weapon.shoot(this);
        this.scene.sound.play('sfx_laser1', {volume: 0.3});

        this._lastShotTime = now;
    }
}
