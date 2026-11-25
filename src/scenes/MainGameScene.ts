import {Core, GameObjects, Input, Scene, Scenes} from 'phaser';
import Health from "../components/Health.ts";
import Boss from "../entities/Boss.ts";
import RegistryConstants from "../RegistryConstants.ts";
import SaveManager from "../managers/SaveManager.ts";
import SaveConstants from "../SaveConstants.ts";
import EntityManager from "../managers/EntityManager.ts";
import WaveManager from "../managers/WaveManager.ts";
import ScoreManager from "../managers/ScoreManager.ts";
import Progress from "../managers/Progress.ts";
import GameConstants from "../GameConstants.ts";
import LocalInput from "../input/LocalInput.ts";
import GyroSensor from "../input/GyroSensor.ts";
import Settings from "../managers/Settings.ts";
import type {LevelData, LevelsData} from "../gameData/LevelData.ts";
import type {PowerUpsData} from "../gameData/PowerUpData.ts";
import type {PlayerShipsData} from "../gameData/PlayerShipsData.ts";
import {computePlayerStats, UpgradesData} from "../gameData/UpgradeData.ts";

export type MainGameSceneData = {
    /** Index in levels.json */
    level?: number;
};

export type RunResultData = {
    level: number;
    victory: boolean;
    score: number;
    kills: number;
    credits: number;
    newBestScore: boolean;
};

export default class MainGameScene extends Scene {
    private static readonly END_DELAY_MS: number = 1000;
    private static readonly VICTORY_DELAY_MS: number = 3500;
    private static readonly LOOT_ATTRACT_DELAY_MS: number = 800;
    private static readonly BOSS_WARNING_MS: number = 2500;

    private bg: GameObjects.TileSprite;
    private planet: GameObjects.Image;
    private saveManager: SaveManager;
    private entityManager: EntityManager;
    private _levelIndex: number;
    private _level: LevelData;
    private _waveManager: WaveManager;
    private _scoreManager: ScoreManager;
    private _powerUps: PowerUpsData;
    private _boss: Boss | null;
    private _ended: boolean;

    constructor() {
        super(GameConstants.SceneKeys.MAIN_GAME);
    }

    // noinspection JSUnusedGlobalSymbols
    init(data: MainGameSceneData) {
        const levels = (this.cache.json.get(GameConstants.DataKeys.LEVELS) as LevelsData).levels;
        this._levelIndex = Phaser.Math.Clamp(data?.level ?? 0, 0, levels.length - 1);
        this._level = levels[this._levelIndex];
        this._ended = false;
        this._boss = null;
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        this.saveManager.load();
        this._powerUps = this.cache.json.get(GameConstants.DataKeys.POWER_UPS) as PowerUpsData;
        this._scoreManager = new ScoreManager(this);
        this.registry.set(RegistryConstants.Keys.BOSS_HEALTH, -1);

        const upgrades = this.cache.json.get(GameConstants.DataKeys.UPGRADES) as UpgradesData;
        const shipId = Progress.getSelectedShip(this.saveManager);
        const ship = (this.cache.json.get(GameConstants.DataKeys.PLAYER_SHIPS) as PlayerShipsData)[shipId];
        const stats = computePlayerStats(upgrades, Progress.getUpgradeLevels(this.saveManager), ship?.bonus);
        this.registry.set(RegistryConstants.Keys.BOMBS, stats.bombs);

        const bgMargin = 512;
        this.bg = this.add.tileSprite(this.cameras.main.centerX, this.cameras.main.centerY,
            this.cameras.main.width + bgMargin, this.cameras.main.height + bgMargin, 'bg').setTileScale(2);
        this.planet = this.add.image(0, -512, 'planet').setOrigin(0);

        const controls = Settings.getControls(this.saveManager);
        if (controls.mode === 'gyro')
            GyroSensor.calibrate();
        const input = new LocalInput(this, controls.mode === 'gyro' ? controls.gyro : undefined);
        const player = this.entityManager.initAndSpawnPlayer(input, stats, shipId);
        player.getComponent(Health)?.once(Health.DEATH_EVENT, () => {
            // Hide the player and let its explosion play before showing the game over screen
            player.disableBody(true, true);
            this.endRun(false, MainGameScene.END_DELAY_MS);
        }, this);
        this.entityManager.initEnemies();
        this.entityManager.initGroupCollisions();
        this.events.on(EntityManager.CREDITS_COLLECTED_EVENT, this.onCreditsCollected, this);

        this._waveManager = new WaveManager(this, this.entityManager, this._level);
        this._waveManager.on(WaveManager.WAVE_STARTED_EVENT, (index: number, count: number) => {
            this.showBanner(`VAGUE ${index + 1}/${count}`);
        });
        this._waveManager.on(WaveManager.ALL_WAVES_CLEARED_EVENT, () => {
            this.showBanner('ALERTE\nBOSS EN APPROCHE');
            this.cameras.main.flash(300, 120, 0, 0);
            this.time.delayedCall(MainGameScene.BOSS_WARNING_MS, () => this.spawnBoss());
        });

        if (this.input.keyboard) {
            this.input.keyboard.addKey(Input.Keyboard.KeyCodes.R).on('down', () => this.scene.restart());
            this.input.keyboard.addKey(Input.Keyboard.KeyCodes.ESC).on('down', this.pauseGame, this);
            this.input.keyboard.addKey(Input.Keyboard.KeyCodes.P).on('down', this.pauseGame, this);
            this.input.keyboard.addKey(Input.Keyboard.KeyCodes.B).on('down', this.useBomb, this);
        }

        // Pause when the player switches app, locks the phone or changes tab
        this.game.events.on(Core.Events.HIDDEN, this.pauseGame, this);
        this.game.events.on(GameConstants.Events.PAUSE_REQUESTED_EVENT, this.pauseGame, this);
        this.game.events.on(GameConstants.Events.BOMB_REQUESTED_EVENT, this.useBomb, this);
        this.events.once(Scenes.Events.SHUTDOWN, () => {
            this.game.events.off(GameConstants.Events.BOMB_REQUESTED_EVENT, this.useBomb, this);
            this.events.off(EntityManager.CREDITS_COLLECTED_EVENT, this.onCreditsCollected, this);
            this._scoreManager.destroy();
            this.game.events.off(Core.Events.HIDDEN, this.pauseGame, this);
            this.game.events.off(GameConstants.Events.PAUSE_REQUESTED_EVENT, this.pauseGame, this);
            this._waveManager.removeAllListeners();
            this.events.off(Boss.PHASE_CHANGED_EVENT);
            this.events.off(Boss.DEFEATED_EVENT);
            input.destroy();
        });

        this.showBanner(`NIVEAU ${this._levelIndex + 1}\n${this._level.name}`);
        this.time.delayedCall(MainGameScene.VICTORY_DELAY_MS, () => this._waveManager.start());
    }

    private spawnBoss() {
        const boss = this.entityManager.spawnBoss(this._level.boss, this._level.difficulty);
        this._boss = boss;
        this.registry.set(RegistryConstants.Keys.BOSS_NAME, boss.bossData.name);
        this.registry.set(RegistryConstants.Keys.BOSS_HEALTH, 1);

        boss.getComponent(Health)?.on(Health.CHANGE_EVENT, () => {
            this.registry.set(RegistryConstants.Keys.BOSS_HEALTH, boss.healthRatio);
        });
        this.events.on(Boss.PHASE_CHANGED_EVENT, (phaseIndex: number) => {
            if (phaseIndex > 0) {
                this.showBanner(`PHASE ${phaseIndex + 1}`);
                this.cameras.main.shake(300, 0.015);
            }
        });
        this.events.once(Boss.DEFEATED_EVENT, () => {
            this._boss = null;
            this.registry.set(RegistryConstants.Keys.BOSS_HEALTH, -1);
            this._scoreManager.addScore(boss.bossData.score);
            this.entityManager.dropCoins(boss.x, boss.y, this._powerUps.bossCreditCoins,
                Math.ceil(boss.bossData.score * this._powerUps.creditsPerScore / this._powerUps.bossCreditCoins));
            this.time.delayedCall(MainGameScene.LOOT_ATTRACT_DELAY_MS, () => this.entityManager.attractAllPickups());
            this.showBanner('NIVEAU TERMINÉ');
            this.endRun(true, MainGameScene.VICTORY_DELAY_MS);
        });
    }

    private onCreditsCollected(credits: number) {
        this._scoreManager.addCredits(credits);
    }

    private useBomb() {
        if (this._ended || !this.scene.isActive() || Number(this.registry.get(RegistryConstants.Keys.BOMBS)) <= 0)
            return;

        this.registry.inc(RegistryConstants.Keys.BOMBS, -1);
        const bomb = this._powerUps.bomb;
        this.entityManager.detonateBomb(bomb.enemyDamage, this._boss, bomb.bossDamage);

        this.cameras.main.flash(250, 255, 255, 255);
        this.cameras.main.shake(400, 0.02);
        navigator.vibrate?.(200);
    }

    private showBanner(text: string) {
        this.game.events.emit(GameConstants.Events.BANNER_EVENT, text);
    }

    private pauseGame() {
        if (!this.scene.isActive())
            return;

        this.scene.pause();
        this.scene.launch(GameConstants.SceneKeys.PAUSE);
    }

    private endRun(victory: boolean, delayMs: number) {
        if (this._ended)
            return;
        this._ended = true;

        // Results are read after the delay, so coins picked up meanwhile still count
        this.time.delayedCall(delayMs, () => this.finishRun(victory));
    }

    private finishRun(victory: boolean) {
        const bestScore: number = Number(this.saveManager.getData(SaveConstants.Keys.PLAYER_BEST_SCORE) ?? 0);
        const currentScore: number = Number(this.registry.get(RegistryConstants.Keys.PLAYER_SCORE) ?? 0);
        const newBestScore = currentScore > bestScore;
        if (newBestScore)
            this.saveManager.setData(SaveConstants.Keys.PLAYER_BEST_SCORE, currentScore);

        // Credits are kept even on a lost run, so every attempt makes the ship stronger
        const credits = Number(this.registry.get(RegistryConstants.Keys.RUN_CREDITS) ?? 0);
        Progress.addCredits(this.saveManager, credits);
        if (victory)
            Progress.unlockLevel(this.saveManager, this._levelIndex + 1);

        const result: RunResultData = {
            level: this._levelIndex,
            victory,
            score: currentScore,
            kills: Number(this.registry.get(RegistryConstants.Keys.KILLS) ?? 0),
            credits,
            newBestScore
        };
        this.scene.start(GameConstants.SceneKeys.GAME_OVER, result);
    }

    update(_timeSinceLaunch: number, deltaTime: number) {
        this.bg.tilePositionY -= 0.1 * deltaTime;
        this.planet.y += 0.40 * deltaTime;

        this._waveManager.update();
        this._scoreManager.update(this.time.now);
    }
}
