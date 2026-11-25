import {Input} from "phaser";
import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";

export default class GameOverScene extends Phaser.Scene {
    // The finger is usually still on the screen from playing when the player dies
    private static readonly INPUT_DELAY_MS: number = 800;

    constructor() {
        super(GameConstants.SceneKeys.GAME_OVER);
    }

    create() {
        this.scene.stop(GameConstants.SceneKeys.MAIN_UI);

        const screenCenterX: number = this.scale.width / 2;
        const titleY: number = this.scale.height / 3;
        this.add.text(screenCenterX, titleY, 'GAME OVER',
            {fontSize: '96px', color: '#fff', align: 'center'}).setOrigin(0.5);
        this.add.text(screenCenterX, titleY + 160, "SCORE",
            {fontSize: '48px', align: 'center'}).setOrigin(0.5);

        this.add.text(screenCenterX, titleY + 220, this.registry.get(RegistryConstants.Keys.PLAYER_SCORE).toString(),
            {fontSize: '32px', color: '#fff', align: 'center'}).setOrigin(0.5);

        this.add.text(screenCenterX, this.scale.height - 256, 'Touchez pour rejouer',
            {fontSize: '32px', color: '#fff', align: 'center'}).setOrigin(0.5);

        // Ignore the OS key repeat: SPACE is often still held from shooting when the player dies
        this.input.keyboard?.on('keydown-SPACE', (event: KeyboardEvent) => {
            if (event.repeat)
                return;

            this.scene.start(GameConstants.SceneKeys.HOME);
        });

        this.time.delayedCall(GameOverScene.INPUT_DELAY_MS, () => {
            this.input.once(Input.Events.POINTER_UP, () => this.scene.start(GameConstants.SceneKeys.HOME));
        });

        console.log("GameOverScene created");
    }
}