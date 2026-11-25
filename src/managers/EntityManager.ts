import {GameObjects, Plugins, Physics, Scene, Scenes} from "phaser";
import Health from "../components/Health.ts";
import Boss from "../entities/Boss.ts";
import Bullet from "../entities/Bullet.ts";
import Enemy from "../entities/Enemy.ts";
import Pickup from "../entities/Pickup.ts";
import Player from "../entities/Player.ts";
import type {BossesData} from "../gameData/BossData.ts";
import type {EnemiesData} from "../gameData/EnemyData.ts";
import type {PickupType, PowerUpsData, PowerUpType} from "../gameData/PowerUpData.ts";
import type {PlayerStats} from "../gameData/UpgradeData.ts";
import type {IInputSource} from "../input/InputState.ts";
import GroupUtils from "../utils/GroupUtils.ts";
import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";
import TextureFactory from "../utils/TextureFactory.ts";

export default class EntityManager extends Plugins.ScenePlugin {
    public static readonly PLUGIN_KEY: string = 'EntityManager';
    public static readonly MAPPING_NAME: string = 'entityManager';

    /** (credits: number) emitted on the scene events when the player picks up coins */
    public static readonly CREDITS_COLLECTED_EVENT: string = 'creditsCollected';

    private static readonly ENEMY_SPAWN_MARGIN: number = 64;
    private static readonly MAX_COINS_PER_ENEMY: number = 4;

    // noinspection JSUnusedGlobalSymbols
    private readonly bulletGroupConfig = {
        classType: Bullet,
        maxSize: 512,
        runChildUpdate: true,
        createCallback: (bullet: GameObjects.GameObject) => {
            (bullet as Bullet).init();
        }
    }

    private _player: Player;
    private _playerBullets: Physics.Arcade.Group;
    private _enemyBullets: Physics.Arcade.Group;
    /** One pool per enemy type of enemies.json */
    private _enemyPools: Map<string, Physics.Arcade.Group>;
    private _pickups: Physics.Arcade.Group;
    private _powerUps: PowerUpsData;

    public get player(): Player {
        return this._player;
    }

    public get enemyBullets(): Physics.Arcade.Group {
        return this._enemyBullets;
    }

    constructor(scene: Scene, pluginManager: Plugins.PluginManager) {
        super(scene, pluginManager, EntityManager.PLUGIN_KEY);
    }

    public initAndSpawnPlayer(input: IInputSource, stats: PlayerStats, shipId: number): Player {
        this._powerUps = this.scene!.cache.json.get(GameConstants.DataKeys.POWER_UPS) as PowerUpsData;

        this._playerBullets = this.scene!.physics.add.group(this.bulletGroupConfig);
        GroupUtils.populate(64, this._playerBullets);

        this._player = new Player(this.scene!, this.scene!.cameras.main.centerX, this.scene!.cameras.main.height - 128);
        this._player.init(this._playerBullets, input, stats, this._powerUps, shipId);

        this.game!.events.emit(GameConstants.Events.PLAYER_SPAWNED_EVENT, this._player);

        return this._player;
    }

    public initEnemies() {
        this._enemyBullets = this.scene!.physics.add.group(this.bulletGroupConfig);
        GroupUtils.populate(256, this._enemyBullets);

        const enemiesData = this.scene!.cache.json.get(GameConstants.DataKeys.ENEMIES) as EnemiesData;
        this._enemyPools = new Map();
        for (const [type, data] of Object.entries(enemiesData)) {
            this._enemyPools.set(type, this.scene!.physics.add.group({
                classType: Enemy,
                defaultKey: 'sprites',
                defaultFrame: data.texture,
                createCallback: (enemy) => {
                    (enemy as Enemy).init(type, data, this._enemyBullets, this._player);
                }
            }));
        }

        // Scene events survive a scene restart: remove the listener with the scene
        this._pickups = this.scene!.physics.add.group({
            classType: Pickup,
            defaultKey: TextureFactory.pickupKey('credit'),
            createCallback: (pickup) => (pickup as Pickup).init()
        });

        this.scene!.events.on(Enemy.KILLED_EVENT, this.onEnemyKilled, this);
        this.scene!.events.once(Scenes.Events.SHUTDOWN, () => {
            this.scene!.events.off(Enemy.KILLED_EVENT, this.onEnemyKilled, this);
        });
    }

    public initGroupCollisions() {
        this._enemyPools.forEach(pool => this.initEnemyCollisions(pool));

        this.scene!.physics.add.overlap(this._player, this._enemyBullets, (_player, bullet) => {
            (bullet as Bullet).disable();
            this._player.hit((bullet as Bullet).damage);

            this.scene?.cameras.main.shake(100, 0.01);
        });

        this.scene!.physics.add.overlap(this._player, this._pickups, (_player, pickup) => {
            this.collect(pickup as Pickup);
        });
    }

    /**
     * @param x clamped so the enemy is fully on screen
     * @param y 0 to appear right above the screen, negative to appear higher
     */
    public spawnEnemy(type: string, x: number, y: number = 0, difficulty: number = 1): Enemy | null {
        const pool = this._enemyPools.get(type);
        if (!pool) {
            console.error(`[EntityManager] Unknown enemy type "${type}"`);
            return null;
        }

        const enemy = pool.get() as Enemy | null;
        if (!enemy)
            return null;

        const margin = EntityManager.ENEMY_SPAWN_MARGIN;
        enemy.enable(Phaser.Math.Clamp(x, margin, this.scene!.cameras.main.width - margin), y, difficulty);

        this.game!.events.emit(GameConstants.Events.ENEMY_SPAWNED_EVENT, enemy);

        return enemy;
    }

    public spawnBoss(bossKey: string, difficulty: number): Boss {
        const data = (this.scene!.cache.json.get(GameConstants.DataKeys.BOSSES) as BossesData)[bossKey];
        const boss = new Boss(this.scene!, data, this._enemyBullets, this._player, difficulty);

        this.scene!.physics.add.overlap(this._playerBullets, boss, (_boss, bullet) => {
            (bullet as Bullet).disable();
            boss.getComponent(Health)?.damage((bullet as Bullet).damage);
        });
        this.scene!.physics.add.overlap(this._player, boss, () => {
            this._player.hit(1);
            this.scene?.cameras.main.shake(100, 0.03);
        });

        const onSummon = (enemyType: string, x: number, y: number) => this.spawnEnemy(enemyType, x, y, difficulty);
        this.scene!.events.on(Boss.SUMMON_EVENT, onSummon);
        boss.once(Phaser.GameObjects.Events.DESTROY, () => this.scene?.events.off(Boss.SUMMON_EVENT, onSummon));

        return boss;
    }

    /** Coins scattered around a point, e.g. where a boss died */
    public dropCoins(x: number, y: number, coins: number, creditsPerCoin: number) {
        for (let i = 0; i < coins; i++)
            this.spawnPickup('credit', x, y, creditsPerCoin);
    }

    /** Every pickup on screen flies to the player, to collect the loot at the end of a level */
    public attractAllPickups() {
        this._pickups.getMatching('active', true).forEach(pickup => (pickup as Pickup).attractTo(this._player));
    }

    /**
     * Clears every enemy bullet and damages every enemy on screen.
     */
    public detonateBomb(enemyDamage: number, boss: Boss | null, bossDamage: number) {
        this._enemyBullets.getMatching('active', true).forEach(bullet => (bullet as Bullet).disable());
        this._enemyPools.forEach(pool => {
            pool.getMatching('active', true).forEach(enemy => (enemy as Enemy).getComponent(Health)?.damage(enemyDamage));
        });
        boss?.getComponent(Health)?.damage(bossDamage);
    }

    public activeEnemyCount(): number {
        let count = 0;
        this._enemyPools.forEach(pool => count += pool.countActive(true));
        return count;
    }

    private onEnemyKilled(enemy: Enemy) {
        const credits = Math.ceil(enemy.enemyData.score * this._powerUps.creditsPerScore);
        const coins = Math.min(credits, EntityManager.MAX_COINS_PER_ENEMY);
        // Spread the credits over a few coins, the first coin takes the remainder
        for (let i = 0; i < coins; i++) {
            const value = Math.floor(credits / coins) + (i === 0 ? credits % coins : 0);
            this.spawnPickup('credit', enemy.x, enemy.y, value);
        }

        if (Math.random() < enemy.enemyData.dropChance)
            this.spawnPickup(this.randomPowerUp(), enemy.x, enemy.y, 0);
    }

    private randomPowerUp(): PowerUpType {
        const weights = Object.entries(this._powerUps.dropWeights) as [PowerUpType, number][];
        const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
        let roll = Math.random() * total;
        for (const [type, weight] of weights) {
            roll -= weight;
            if (roll < 0)
                return type;
        }
        return weights[0][0];
    }

    private spawnPickup(type: PickupType, x: number, y: number, value: number) {
        const pickup = this._pickups.get() as Pickup | null;
        pickup?.enable(type, x, y, value, this._player, this._player.magnetRadius);
    }

    private collect(pickup: Pickup) {
        pickup.disable();

        switch (pickup.pickupType) {
            case 'credit':
                this.scene!.events.emit(EntityManager.CREDITS_COLLECTED_EVENT, pickup.value);
                break;
            case 'bomb':
                this.scene!.registry.inc(RegistryConstants.Keys.BOMBS, this._powerUps.bomb.amount);
                this._player.applyPowerUp('bomb');
                break;
            default:
                this._player.applyPowerUp(pickup.pickupType);
        }
    }

    private initEnemyCollisions(enemies: Physics.Arcade.Group) {
        this.scene!.physics.add.overlap(this._playerBullets, enemies, (bullet, enemy) => {
            (bullet as Bullet).disable();
            (enemy as Enemy).getComponent(Health)?.damage((bullet as Bullet).damage);
        });

        this.scene!.physics.add.overlap(this._player, enemies, (_player, enemy) => {
            const enemyHealth = (enemy as Enemy).getComponent(Health);
            enemyHealth?.damage(enemyHealth?.max);

            this._player.hit(1);

            this.scene?.cameras.main.shake(100, 0.03);
        });
    }
}
