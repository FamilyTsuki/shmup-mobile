import {Core, GameObjects, Input, Scene, Scenes} from 'phaser';
import Health from "../components/Health.ts";
import RegistryConstants from "../RegistryConstants.ts";
import SaveManager from "../managers/SaveManager.ts";
import SaveConstants from "../SaveConstants.ts";
import EntityManager from "../managers/EntityManager.ts";
import WaveManager from "../managers/WaveManager.ts";
import GameConstants from "../GameConstants.ts";
import LocalInput from "../input/LocalInput.ts";
import GyroSensor from "../input/GyroSensor.ts";
import Settings from "../managers/Settings.ts";
import type {LevelData, LevelsData} from "../gameData/LevelData.ts";

export type MainGameSceneData = {
    /** Index in levels.json */
    level?: number;
};

export type RunResultData = {
    level: number;
    victory: boolean;
};

export default class MainGameScene extends Scene {
    private static readonly END_DELAY_MS: number = 1000;
    private static readonly VICTORY_DELAY_MS: number = 2500;

    private bg: GameObjects.TileSprite;
    private planet: GameObjects.Image;
    private saveManager: SaveManager;
    private entityManager: EntityManager;
    private _levelIndex: number;
    private _level: LevelData;
    private _waveManager: WaveManager;
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
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        this.saveManager.load();
        this.registry.set(RegistryConstants.Keys.PLAYER_SCORE, 0);

        const bgMargin = 512;
        this.bg = this.add.tileSprite(this.cameras.main.centerX, this.cameras.main.centerY,
            this.cameras.main.width + bgMargin, this.cameras.main.height + bgMargin, 'bg').setTileScale(2);
        this.planet = this.add.image(0, -512, 'planet').setOrigin(0);

        const controls = Settings.getControls(this.saveManager);
        if (controls.mode === 'gyro')
            GyroSensor.calibrate();
        const input = new LocalInput(this, controls.mode === 'gyro' ? controls.gyro : undefined);
        const player = this.entityManager.initAndSpawnPlayer(input);
        player.getComponent(Health)?.once(Health.DEATH_EVENT, () => {
            // Hide the player and let its explosion play before showing the game over screen
            player.disableBody(true, true);
            this.endRun(false, MainGameScene.END_DELAY_MS);
        }, this);
        this.entityManager.initEnemies();
        this.entityManager.initGroupCollisions();

        this._waveManager = new WaveManager(this, this.entityManager, this._level);
        this._waveManager.on(WaveManager.WAVE_STARTED_EVENT, (index: number, count: number) => {
            this.showBanner(`VAGUE ${index + 1}/${count}`);
        });
        this._waveManager.on(WaveManager.ALL_WAVES_CLEARED_EVENT, () => {
            this.showBanner('NIVEAU TERMINÉ');
            this.endRun(true, MainGameScene.VICTORY_DELAY_MS);
        });

        if (this.input.keyboard) {
            this.input.keyboard.addKey(Input.Keyboard.KeyCodes.R).on('down', () => this.scene.restart());
            this.input.keyboard.addKey(Input.Keyboard.KeyCodes.ESC).on('down', this.pauseGame, this);
            this.input.keyboard.addKey(Input.Keyboard.KeyCodes.P).on('down', this.pauseGame, this);
        }

        // Pause when the player switches app, locks the phone or changes tab
        this.game.events.on(Core.Events.HIDDEN, this.pauseGame, this);
        this.game.events.on(GameConstants.Events.PAUSE_REQUESTED_EVENT, this.pauseGame, this);
        this.events.once(Scenes.Events.SHUTDOWN, () => {
            this.game.events.off(Core.Events.HIDDEN, this.pauseGame, this);
            this.game.events.off(GameConstants.Events.PAUSE_REQUESTED_EVENT, this.pauseGame, this);
            this._waveManager.removeAllListeners();
            input.destroy();
        });

        this.showBanner(`NIVEAU ${this._levelIndex + 1}\n${this._level.name}`);
        this.time.delayedCall(MainGameScene.VICTORY_DELAY_MS, () => this._waveManager.start());
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

        const bestScore: number = Number(this.saveManager.getData(SaveConstants.Keys.PLAYER_BEST_SCORE) ?? 0);
        const currentScore: number = Number(this.registry.get(RegistryConstants.Keys.PLAYER_SCORE) ?? 0);
        if (currentScore > bestScore)
            this.saveManager.setData(SaveConstants.Keys.PLAYER_BEST_SCORE, currentScore);

        const result: RunResultData = {level: this._levelIndex, victory};
        this.time.delayedCall(delayMs, () => this.scene.start(GameConstants.SceneKeys.GAME_OVER, result));
    }

    update(_timeSinceLaunch: number, deltaTime: number) {
        this.bg.tilePositionY -= 0.1 * deltaTime;
        this.planet.y += 0.40 * deltaTime;

        this._waveManager.update();
    }
}
