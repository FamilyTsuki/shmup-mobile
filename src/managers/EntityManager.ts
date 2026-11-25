import {GameObjects, Plugins, Physics, Scene, Scenes} from "phaser";
import Health from "../components/Health.ts";
import Boss from "../entities/Boss.ts";
import Bullet from "../entities/Bullet.ts";
import Enemy from "../entities/Enemy.ts";
import Player from "../entities/Player.ts";
import type {BossesData} from "../gameData/BossData.ts";
import type {EnemiesData} from "../gameData/EnemyData.ts";
import type {IInputSource} from "../input/InputState.ts";
import GroupUtils from "../utils/GroupUtils.ts";
import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";

export default class EntityManager extends Plugins.ScenePlugin {
    public static readonly PLUGIN_KEY: string = 'EntityManager';
    public static readonly MAPPING_NAME: string = 'entityManager';

    private static readonly ENEMY_SPAWN_MARGIN: number = 64;

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

    public get player(): Player {
        return this._player;
    }

    public get enemyBullets(): Physics.Arcade.Group {
        return this._enemyBullets;
    }

    constructor(scene: Scene, pluginManager: Plugins.PluginManager) {
        super(scene, pluginManager, EntityManager.PLUGIN_KEY);
    }

    public initAndSpawnPlayer(input: IInputSource): Player {
        this._playerBullets = this.scene!.physics.add.group(this.bulletGroupConfig);
        GroupUtils.populate(64, this._playerBullets);

        this._player = new Player(this.scene!, this.scene!.cameras.main.centerX, this.scene!.cameras.main.height - 128);
        this._player.init(this._playerBullets, input);

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
        this.scene!.events.on(Enemy.KILLED_EVENT, this.onEnemyKilled, this);
        this.scene!.events.once(Scenes.Events.SHUTDOWN, () => {
            this.scene!.events.off(Enemy.KILLED_EVENT, this.onEnemyKilled, this);
        });
    }

    public initGroupCollisions() {
        this._enemyPools.forEach(pool => this.initEnemyCollisions(pool));

        this.scene!.physics.add.overlap(this._player, this._enemyBullets, (player, bullet) => {
            (bullet as Bullet).disable();
            (player as Player).getComponent(Health)?.damage((bullet as Bullet).damage);

            this.scene?.cameras.main.shake(100, 0.01);
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
            this._player.getComponent(Health)?.damage(1);
            this.scene?.cameras.main.shake(100, 0.03);
        });

        const onSummon = (enemyType: string, x: number, y: number) => this.spawnEnemy(enemyType, x, y, difficulty);
        this.scene!.events.on(Boss.SUMMON_EVENT, onSummon);
        boss.once(Phaser.GameObjects.Events.DESTROY, () => this.scene?.events.off(Boss.SUMMON_EVENT, onSummon));

        return boss;
    }

    public activeEnemyCount(): number {
        let count = 0;
        this._enemyPools.forEach(pool => count += pool.countActive(true));
        return count;
    }

    private onEnemyKilled(enemy: Enemy) {
        this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE, enemy.enemyData.score);
    }

    private initEnemyCollisions(enemies: Physics.Arcade.Group) {
        this.scene!.physics.add.overlap(this._playerBullets, enemies, (bullet, enemy) => {
            (bullet as Bullet).disable();
            (enemy as Enemy).getComponent(Health)?.damage((bullet as Bullet).damage);
        });

        this.scene!.physics.add.overlap(this._player, enemies, (player, enemy) => {
            const enemyHealth = (enemy as Enemy).getComponent(Health);
            enemyHealth?.damage(enemyHealth?.max);

            (player as Player).getComponent(Health)?.damage(1);

            this.scene?.cameras.main.shake(100, 0.03);
        });
    }
}
