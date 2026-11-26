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
import type {Polarity, PolarityData} from "../gameData/PolarityData.ts";
import type {BulletData} from "../gameData/BulletData.ts";
import type {PlayerStats} from "../gameData/UpgradeData.ts";
import type {IInputSource} from "../input/InputState.ts";
import type Entity from "../entities/Entity.ts";

/** One ship to create: the first one is the player of this device */
export type PlayerSetup = {
    input: IInputSource;
    stats: PlayerStats;
    shipId: number;
    /** Coop room id, 0 for the player of this device */
    peerId: number;
};
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
    /** Converted bullets fan out a little around their target */
    private static readonly CONVERTED_SPREAD_RAD: number = 0.12;

    // noinspection JSUnusedGlobalSymbols
    private readonly bulletGroupConfig = {
        classType: Bullet,
        maxSize: 512,
        runChildUpdate: true,
        createCallback: (bullet: GameObjects.GameObject) => {
            (bullet as Bullet).init();
        }
    }

    private _players: Player[] = [];
    private _playerBullets: Physics.Arcade.Group;
    private _enemyBullets: Physics.Arcade.Group;
    /** One pool per enemy type of enemies.json */
    private _enemyPools: Map<string, Physics.Arcade.Group>;
    private _pickups: Physics.Arcade.Group;
    private _powerUps: PowerUpsData;
    private _polarityData: PolarityData;
    private _boss: Boss | null = null;

    /** The player of this device */
    public get player(): Player {
        return this._players[0];
    }

    /** Every ship, dead or alive, P1 first */
    public get players(): Player[] {
        return this._players;
    }

    public get alivePlayers(): Player[] {
        return this._players.filter(player => player.active && !player.isGhost);
    }

    public get enemyBullets(): Physics.Arcade.Group {
        return this._enemyBullets;
    }

    constructor(scene: Scene, pluginManager: Plugins.PluginManager) {
        super(scene, pluginManager, EntityManager.PLUGIN_KEY);
    }

    /**
     * Creates the ships side by side at the bottom of the screen.
     */
    public spawnPlayers(setups: PlayerSetup[]): Player[] {
        this._powerUps = this.scene!.cache.json.get(GameConstants.DataKeys.POWER_UPS) as PowerUpsData;
        this._polarityData = this.scene!.cache.json.get(GameConstants.DataKeys.POLARITY) as PolarityData;
        this._boss = null;

        // Bursts turn many enemy bullets into player shots at once
        this._playerBullets = this.scene!.physics.add.group({...this.bulletGroupConfig, maxSize: 320});
        GroupUtils.populate(160, this._playerBullets);

        const camera = this.scene!.cameras.main;
        this._players = setups.map((setup, index) => {
            const x = camera.width * (index + 1) / (setups.length + 1);
            const player = new Player(this.scene!, x, camera.height - GameConstants.PLAYER_Y_FROM_BOTTOM, index === 0);
            player.peerId = setup.peerId;
            player.index = index;
            player.init(this._playerBullets, setup.input, setup.stats, this._powerUps, this._polarityData, setup.shipId);
            return player;
        });

        this.game!.events.emit(GameConstants.Events.PLAYER_SPAWNED_EVENT, this.player);

        return this._players;
    }

    /** The closest living ship, what enemies aim at */
    public closestPlayer(from: Entity): Player | null {
        let closest: Player | null = null;
        let closestDistance = Number.POSITIVE_INFINITY;
        for (const player of this.alivePlayers) {
            const distance = Phaser.Math.Distance.Squared(from.x, from.y, player.x, player.y);
            if (distance < closestDistance) {
                closest = player;
                closestDistance = distance;
            }
        }
        return closest;
    }

    /** Any living ship: bosses spread their attacks over every player */
    public randomPlayer(): Player | null {
        const alive = this.alivePlayers;
        return alive.length > 0 ? Phaser.Utils.Array.GetRandom(alive) : null;
    }

    public initEnemies() {
        this._enemyBullets = this.scene!.physics.add.group(this.bulletGroupConfig);
        GroupUtils.populate(256, this._enemyBullets);

        const enemiesData = this.scene!.cache.json.get(GameConstants.DataKeys.ENEMIES) as EnemiesData;
        this._enemyPools = new Map();
        for (const [type, data] of Object.entries(enemiesData)) {
            this._enemyPools.set(type, this.scene!.physics.add.group({
                classType: Enemy,
                defaultKey: TextureFactory.shipKey(data.texture, 'ion'),
                createCallback: (enemy) => {
                    (enemy as Enemy).init(type, data, this._enemyBullets, (from) => this.closestPlayer(from));
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

        this.scene!.physics.add.overlap(this._players, this._enemyBullets, (player, bullet) => {
            (player as Player).touchBullet(bullet as Bullet);
        });

        this.scene!.physics.add.overlap(this._players, this._pickups, (player, pickup) => {
            this.collect(pickup as Pickup, player as Player);
        });
    }

    /**
     * @param x clamped so the enemy is fully on screen
     * @param y 0 to appear right above the screen, negative to appear higher
     */
    public spawnEnemy(type: string, x: number, y: number = 0, difficulty: number = 1,
                      polarity: Polarity = 'ion'): Enemy | null {
        const pool = this._enemyPools.get(type);
        if (!pool) {
            console.error(`[EntityManager] Unknown enemy type "${type}"`);
            return null;
        }

        const enemy = pool.get() as Enemy | null;
        if (!enemy)
            return null;

        const margin = EntityManager.ENEMY_SPAWN_MARGIN;
        enemy.enable(Phaser.Math.Clamp(x, margin, this.scene!.cameras.main.width - margin), y, difficulty, polarity);

        this.game!.events.emit(GameConstants.Events.ENEMY_SPAWNED_EVENT, enemy);

        return enemy;
    }

    public spawnBoss(bossKey: string, difficulty: number): Boss {
        const data = (this.scene!.cache.json.get(GameConstants.DataKeys.BOSSES) as BossesData)[bossKey];
        const boss = new Boss(this.scene!, data, this._enemyBullets, () => this.randomPlayer(), difficulty);
        this._boss = boss;
        boss.once(Phaser.GameObjects.Events.DESTROY, () => this._boss = null);

        this.scene!.physics.add.overlap(this._playerBullets, boss, (_boss, bullet) => {
            (bullet as Bullet).disable();
            boss.getComponent(Health)?.damage(this.shotDamage(bullet as Bullet, boss.polarity));
        });
        this.scene!.physics.add.overlap(this._players, boss, (player) => {
            (player as Player).hit(1);
        });

        const onSummon = (enemyType: string, x: number, y: number, polarity: Polarity) =>
            this.spawnEnemy(enemyType, x, y, difficulty, polarity);
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
        this._pickups.getMatching('active', true).forEach(pickup => {
            const player = this.closestPlayer(pickup as Pickup);
            if (player)
                (pickup as Pickup).attractTo(player);
        });
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

    /**
     * The polarity burst: enemy bullets inside the radius become player shots flying at the closest enemies,
     * and enemies inside take damage.
     * @param strength released resonance in [0, 1]
     * @returns number of converted bullets
     */
    public releaseBurst(x: number, y: number, radius: number, strength: number, polarity: Polarity): number {
        const burst = this._polarityData.burst;
        const shotData: BulletData = {...burst.convertedBullet, polarity, shape: 'bolt'};
        const targets = this.activeTargets();

        let converted = 0;
        this._enemyBullets.getMatching('active', true).forEach(child => {
            const bullet = child as Bullet;
            if (Phaser.Math.Distance.Between(x, y, bullet.x, bullet.y) > radius)
                return;

            const shot = this._playerBullets.get() as Bullet | null;
            const angle = this.angleToClosest(bullet.x, bullet.y, targets)
                + Phaser.Math.FloatBetween(-EntityManager.CONVERTED_SPREAD_RAD, EntityManager.CONVERTED_SPREAD_RAD);
            shot?.enable(bullet.x, bullet.y, Math.cos(angle) * shotData.speed, Math.sin(angle) * shotData.speed, shotData);
            bullet.disable();
            converted++;
        });

        const enemyDamage = Math.ceil(burst.enemyDamage * strength);
        targets.forEach(target => {
            if (Phaser.Math.Distance.Between(x, y, target.x, target.y) > radius)
                return;
            const damage = target instanceof Boss ? Math.ceil(burst.bossDamage * strength) : enemyDamage;
            target.getComponent(Health)?.damage(damage);
        });

        return converted;
    }

    public activeEnemies(): Enemy[] {
        const enemies: Enemy[] = [];
        this._enemyPools.forEach(pool => pool.getMatching('active', true).forEach(enemy => enemies.push(enemy as Enemy)));
        return enemies;
    }

    public activeEnemyCount(): number {
        let count = 0;
        this._enemyPools.forEach(pool => count += pool.countActive(true));
        return count;
    }

    /** Player shots hit harder on the opposite polarity */
    private shotDamage(bullet: Bullet, targetPolarity: Polarity): number {
        return bullet.polarity === targetPolarity
            ? bullet.damage
            : bullet.damage * this._polarityData.oppositeDamageMultiplier;
    }

    private activeTargets(): (Enemy | Boss)[] {
        const targets: (Enemy | Boss)[] = [];
        this._enemyPools.forEach(pool => pool.getMatching('active', true).forEach(enemy => targets.push(enemy as Enemy)));
        if (this._boss?.active)
            targets.push(this._boss);
        return targets;
    }

    /** Straight up when no enemy is left */
    private angleToClosest(x: number, y: number, targets: (Enemy | Boss)[]): number {
        let closest: Enemy | Boss | null = null;
        let closestDistance = Number.POSITIVE_INFINITY;
        for (const target of targets) {
            const distance = Phaser.Math.Distance.Squared(x, y, target.x, target.y);
            if (distance < closestDistance) {
                closest = target;
                closestDistance = distance;
            }
        }
        return closest ? Phaser.Math.Angle.Between(x, y, closest.x, closest.y) : -Math.PI / 2;
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
        if (!pickup)
            return;
        // Flies to the closest ship once in its magnet radius
        pickup.enable(type, x, y, value, this.player, this.player.magnetRadius);
        const closest = this.closestPlayer(pickup);
        if (closest)
            pickup.setMagnet(closest, closest.magnetRadius);
    }

    private collect(pickup: Pickup, player: Player) {
        pickup.disable();

        switch (pickup.pickupType) {
            case 'credit':
                this.scene!.events.emit(EntityManager.CREDITS_COLLECTED_EVENT, pickup.value);
                break;
            case 'bomb':
                this.scene!.registry.inc(RegistryConstants.Keys.BOMBS, this._powerUps.bomb.amount);
                player.applyPowerUp('bomb');
                break;
            default:
                player.applyPowerUp(pickup.pickupType);
        }
    }

    private initEnemyCollisions(enemies: Physics.Arcade.Group) {
        this.scene!.physics.add.overlap(this._playerBullets, enemies, (bullet, enemy) => {
            (bullet as Bullet).disable();
            (enemy as Enemy).getComponent(Health)?.damage(this.shotDamage(bullet as Bullet, (enemy as Enemy).polarity));
        });

        this.scene!.physics.add.overlap(this._players, enemies, (player, enemy) => {
            const enemyHealth = (enemy as Enemy).getComponent(Health);
            enemyHealth?.damage(enemyHealth?.max);

            (player as Player).hit(1);
        });
    }
}
