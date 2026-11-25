import {Input, Scene} from "phaser";
import GameConstants from "../GameConstants.ts";
import GyroSensor from "../input/GyroSensor.ts";
import SaveManager from "../managers/SaveManager.ts";
import Settings from "../managers/Settings.ts";
import Button from "../ui/Button.ts";

/**
 * Overlay shown on top of the paused game.
 */
export default class PauseScene extends Scene {
    // Ignore the key that opened the pause, and lets a phone screen settle after unlocking
    private static readonly RESUME_DELAY_MS: number = 300;

    private saveManager: SaveManager;

    constructor() {
        super(GameConstants.SceneKeys.PAUSE);
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        const {width, height} = this.scale;
        const centerX = width / 2;

        this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0).setInteractive();
        this.add.text(centerX, 560, 'PAUSE', {fontSize: '128px', color: '#fff', fontFamily: 'future'}).setOrigin(0.5);

        new Button(this, centerX, 900, 'REPRENDRE', () => this.resumeGame());
        if (Settings.getControls(this.saveManager).mode === 'gyro') {
            new Button(this, centerX, 1100, 'RECALIBRER', () => {
                GyroSensor.calibrate();
                this.resumeGame();
            });
        }
        new Button(this, centerX, 1300, 'QUITTER', () => this.quitGame());

        this.scene.bringToTop();

        this.time.delayedCall(PauseScene.RESUME_DELAY_MS, () => {
            this.input.keyboard?.once(Input.Keyboard.Events.ANY_KEY_DOWN, this.resumeGame, this);
        });
    }

    private resumeGame() {
        this.scene.resume(GameConstants.SceneKeys.MAIN_GAME);
        this.scene.stop();
    }

    private quitGame() {
        this.scene.stop(GameConstants.SceneKeys.MAIN_GAME);
        this.scene.stop(GameConstants.SceneKeys.MAIN_UI);
        this.scene.start(GameConstants.SceneKeys.HOME);
    }
}
