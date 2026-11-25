import {Input, Scene} from "phaser";
import GameConstants from "../GameConstants.ts";

/**
 * Overlay shown on top of the paused game. Any tap or key press resumes the game.
 */
export default class PauseScene extends Scene {
    // Ignore the tap or key that opened the pause, and lets a phone screen settle after unlocking
    private static readonly RESUME_DELAY_MS: number = 300;

    constructor() {
        super(GameConstants.SceneKeys.PAUSE);
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        const {width, height} = this.scale;

        this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0);
        this.add.text(width / 2, height / 2, 'PAUSE',
            {fontSize: '128px', color: '#fff', fontFamily: 'future'}).setOrigin(0.5);
        this.add.text(width / 2, height / 2 + 128, 'Touchez pour reprendre',
            {fontSize: '48px', color: '#fff'}).setOrigin(0.5);

        this.scene.bringToTop();

        this.time.delayedCall(PauseScene.RESUME_DELAY_MS, () => {
            this.input.once(Input.Events.POINTER_UP, this.resumeGame, this);
            this.input.keyboard?.once(Input.Keyboard.Events.ANY_KEY_DOWN, this.resumeGame, this);
        });
    }

    private resumeGame() {
        this.scene.resume(GameConstants.SceneKeys.MAIN_GAME);
        this.scene.stop();
    }
}
