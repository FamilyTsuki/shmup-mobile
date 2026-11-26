import {Input, Scene} from "phaser";
import GameConstants from "../GameConstants.ts";
import GyroSensor from "../input/GyroSensor.ts";
import SaveManager from "../managers/SaveManager.ts";
import Settings from "../managers/Settings.ts";
import Button from "../ui/Button.ts";
import UiStyle from "../ui/UiStyle.ts";
import Net from "../net/Net.ts";
import AudioBus from "../audio/AudioBus.ts";
import type {OptionsSceneData} from "./OptionsScene.ts";

export type PauseSceneData = {
    /** The paused game scene, the solo or host game when omitted */
    gameKey?: string;
};

/**
 * Overlay shown on top of the paused game.
 */
export default class PauseScene extends Scene {
    // Ignore the key that opened the pause, and lets a phone screen settle after unlocking
    private static readonly RESUME_DELAY_MS: number = 300;

    private saveManager: SaveManager;
    private _gameKey: string = GameConstants.SceneKeys.MAIN_GAME;

    constructor() {
        super(GameConstants.SceneKeys.PAUSE);
    }

    // noinspection JSUnusedGlobalSymbols
    create(data: PauseSceneData) {
        const {width, height} = this.scale;
        const centerX = width / 2;
        this._gameKey = data?.gameKey ?? GameConstants.SceneKeys.MAIN_GAME;

        this.add.rectangle(0, 0, width, height, 0x0f0c1d, 0.8).setOrigin(0).setInteractive();
        this.add.text(centerX, 560, Net.role === 'guest' ? 'MENU' : 'PAUSE', UiStyle.text(128)).setOrigin(0.5);
        if (Net.role === 'guest')
            this.add.text(centerX, 700, "La partie continue chez l'hôte", UiStyle.body(40)).setOrigin(0.5);

        new Button(this, centerX, 900, 'REPRENDRE', () => this.resumeGame());
        if (Settings.getControls(this.saveManager).mode === 'gyro') {
            new Button(this, centerX, 1100, 'RECALIBRER', () => {
                GyroSensor.calibrate();
                this.resumeGame();
            });
        }
        new Button(this, centerX, 1300, 'OPTIONS', () => {
            this.scene.launch(GameConstants.SceneKeys.OPTIONS, {returnTo: GameConstants.SceneKeys.PAUSE} satisfies OptionsSceneData);
            this.scene.sleep();
        });
        new Button(this, centerX, 1500, 'QUITTER', () => this.quitGame());

        this.scene.bringToTop();

        // The music goes quiet while paused
        AudioBus.get(this.sound)?.duckMusic(true);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => AudioBus.get(this.sound)?.duckMusic(false));

        this.time.delayedCall(PauseScene.RESUME_DELAY_MS, () => {
            this.input.keyboard?.once(Input.Keyboard.Events.ANY_KEY_DOWN, this.resumeGame, this);
        });
    }

    private resumeGame() {
        this.scene.resume(this._gameKey);
        this.scene.stop();
    }

    /**
     * Coop: a guest leaves the room; the host stops the game for everyone and goes back to the room.
     */
    private quitGame() {
        this.scene.stop(this._gameKey);
        this.scene.stop(GameConstants.SceneKeys.MAIN_UI);
        if (Net.role === 'guest') {
            Net.leave();
            this.scene.start(GameConstants.SceneKeys.HOME);
        } else if (Net.role === 'host') {
            Net.sendToGuests({k: 'abort'});
            this.scene.start(GameConstants.SceneKeys.LOBBY, {});
        } else {
            this.scene.start(GameConstants.SceneKeys.HOME);
        }
    }
}
