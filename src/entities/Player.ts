import {Input, Physics, Scene} from "phaser";
import {PlayerShipData, PlayerShipsData} from "../gameData/PlayerShipsData.ts";
import type {BulletData} from "../gameData/BulletData.ts";
import type {PowerUpsData, PowerUpType} from "../gameData/PowerUpData.ts";
import type {PlayerStats} from "../gameData/UpgradeData.ts";
import type {IInputSource} from "../input/InputState.ts";
import Entity from './Entity.ts';
import Health from "../components/Health.ts";
import Movement from "../components/Movement.ts";
import SpreadWeapon from "../components/SpreadWeapon.ts";
import TextureFactory from "../utils/TextureFactory.ts";

export default class Player extends Entity {
    /** Emitted on the scene events when the player loses health (not when a shield absorbs the hit) */
    public static readonly HIT_EVENT: string = 'playerHit';
    /** (type: PowerUpType) emitted on the scene events */
    public static readonly POWER_UP_EVENT: string = 'playerPowerUp';

    private static readonly INVULNERABLE_MS: number = 1200;
    private static readonly SHIELD_BREAK_INVULNERABLE_MS: number = 500;
    private static readonly BLINK_MS: number = 100;
    private static readonly SPREAD_DEG_PER_EXTRA_BULLET: number = 7;
    private static readonly HIT_VIBRATION_MS: number = 120;

    private readonly _bulletData: BulletData = {
        width: 12,
        height: 4,
        color: 0xffe066,
        speed: 1024,
        damage: 1
    };

    private _input: IInputSource;
    private _stats: PlayerStats;
    private _powerUps: PowerUpsData;
    private _weapon: SpreadWeapon;
    private _playerShipData: PlayerShipData;
    private _lastShotTime: number = 0;
    private _invulnerableUntil: number = 0;
    private _rapidFireUntil: number = 0;
    private _multiShotUntil: number = 0;
    private _shieldHits: number = 0;
    private _shieldSprite: Phaser.GameObjects.Image;

    public get magnetRadius(): number {
        return this._stats.magnetRadius;
    }

    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, 'sprites');

        if (this.scene.input.keyboard) {
            this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.ONE).on('down', () => this.selectPlayerShip(1));
            this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.TWO).on('down', () => this.selectPlayerShip(2));
            this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.THREE).on('down', () => this.selectPlayerShip(3));
        }
    }

    public init(bulletsGroup: Physics.Arcade.Group, input: IInputSource, stats: PlayerStats,
                powerUps: PowerUpsData, shipId: number) {
        this._input = input;
        this._stats = stats;
        this._powerUps = powerUps;
        this._bulletData.damage = stats.damage;

        this.addComponent(new Health(stats.maxHealth, this));
        this.addComponent(new Movement());
        this._weapon = new SpreadWeapon(bulletsGroup, this._bulletData, stats.bulletCount, 0);
        this.addComponent(this._weapon);

        this.angle = -90;
        this.selectPlayerShip(shipId);

        this._shieldSprite = this.scene.add.image(this.x, this.y, TextureFactory.SHIELD_KEY).setVisible(false);
        this.getComponent(Health)?.once(Health.DEATH_EVENT, () => this._shieldSprite.setVisible(false));
    }

    public selectPlayerShip(playerShipDataId: number) {
        const playerShipsData = this.scene.cache.json.get('playerShips') as PlayerShipsData;
        this._playerShipData = playerShipsData[playerShipDataId] ?? playerShipsData[1];

        this.setTexture('sprites', this._playerShipData.texture);
        const bodyData = this._playerShipData.body;
        this.arcadeBody.setCircle(bodyData.radius, bodyData.offsetX, bodyData.offsetY);

        this.getComponent(Movement)?.setSpeed(this._playerShipData.movementSpeed);
    }

    /**
     * Every source of damage goes through here: shield and invulnerability frames come first.
     */
    public hit(damage: number) {
        const now = this.scene.time.now;
        if (!this.active || now < this._invulnerableUntil)
            return;

        if (this._shieldHits > 0) {
            this._shieldHits--;
            this._shieldSprite.setVisible(this._shieldHits > 0);
            this.startInvulnerability(Player.SHIELD_BREAK_INVULNERABLE_MS);
            return;
        }

        this.getComponent(Health)?.damage(damage);
        this.scene.events.emit(Player.HIT_EVENT);
        navigator.vibrate?.(Player.HIT_VIBRATION_MS);
        this.startInvulnerability(Player.INVULNERABLE_MS);
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

        this.scene.events.emit(Player.POWER_UP_EVENT, type);
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

        if (inputState.rotate !== 0) {
            this.angle += inputState.rotate * this._playerShipData.movementSpeed * deltaTime;
        } else {
            this.getComponent(Movement)?.moveHorizontally(this, inputState.moveX * deltaTime);
        }
        this.x += inputState.dragX;

        // Stop player from going offscreen
        this.x = Phaser.Math.Clamp(this.x, this.displayWidth / 2, this.scene.cameras.main.width - this.displayWidth / 2);
        this._shieldSprite.setPosition(this.x, this.y);

        if (inputState.fire)
            this.tryShoot(timeSinceLaunch);
    }

    private tryShoot(now: number) {
        const rapidFire = now < this._rapidFireUntil;
        const fireDelay = this._stats.fireDelayMs / (rapidFire ? this._powerUps.rapidFire.fireRateMultiplier : 1);
        if (now - this._lastShotTime < fireDelay)
            return;

        const multiShot = now < this._multiShotUntil;
        const bulletCount = this._stats.bulletCount + (multiShot ? this._powerUps.multiShot.extraBullets : 0);
        this._weapon.setPattern(bulletCount, (bulletCount - 1) * Player.SPREAD_DEG_PER_EXTRA_BULLET);
        this._weapon.shoot(this);
        this.scene.sound.play('sfx_laser1', {volume: 0.5});

        this._lastShotTime = now;
    }
}
