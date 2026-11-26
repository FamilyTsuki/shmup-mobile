import {Scene} from "phaser";
import GameConstants from "../GameConstants.ts";
import type {LevelsData} from "../gameData/LevelData.ts";
import Progress from "../managers/Progress.ts";
import SaveManager from "../managers/SaveManager.ts";
import Button from "../ui/Button.ts";
import launchGame from "./launchGame.ts";
import Net from "../net/Net.ts";
import type {RunResultData} from "./MainGameScene.ts";
import Backdrop from "../effects/Backdrop.ts";
import UiStyle from "../ui/UiStyle.ts";


/**
 * Results of a run, won or lost, and where to go next.
 */
export default class GameOverScene extends Scene {
    // The finger is usually still on the screen from playing when the run ends
    private static readonly INPUT_DELAY_MS: number = 800;

    private saveManager: SaveManager;

    constructor() {
        super(GameConstants.SceneKeys.GAME_OVER);
    }

    // noinspection JSUnusedGlobalSymbols
    create(result: RunResultData) {
        this.scene.stop(GameConstants.SceneKeys.MAIN_UI);

        const centerX = this.scale.width / 2;
        const levels = (this.cache.json.get(GameConstants.DataKeys.LEVELS) as LevelsData).levels;
        const hasNextLevel = result.victory && result.level + 1 < levels.length;

        new Backdrop(this, 0.5);
        this.add.text(centerX, 300, result.victory ? 'VICTOIRE' : 'DEFAITE',
            UiStyle.text(128, '#ffffff', result.victory ? '#7bffb0' : '#ff3d9a')).setOrigin(0.5);
        this.add.text(centerX, 430, `Niveau ${result.level + 1} - ${levels[result.level].name}`,
            UiStyle.body(44, '#ffffff')).setOrigin(0.5);

        const lines: [string, string][] = [
            ['SCORE', String(result.score)],
            ['ENNEMIS', String(result.kills)],
            ['CREDITS GAGNES', `+ ${result.credits}`],
            ['TOTAL', `$ ${Progress.getCredits(this.saveManager)}`],
        ];
        lines.forEach(([label, value], index) => {
            const y = 600 + index * 100;
            this.add.text(140, y, label, UiStyle.text(46, UiStyle.MUTED_CSS)).setOrigin(0, 0.5);
            this.add.text(this.scale.width - 140, y, value, UiStyle.text(52, '#ffd166', '#ffb347')).setOrigin(1, 0.5);
        });

        if (result.newBestScore) {
            const record = this.add.text(centerX, 1010, 'NOUVEAU RECORD !',
                UiStyle.text(60, '#ffe7a3', '#ffb347')).setOrigin(0.5);
            this.tweens.add({targets: record, scale: 1.12, duration: 450, yoyo: true, repeat: -1});
        }
        if (result.victory && !hasNextLevel)
            this.add.text(centerX, 1100, 'La flotte est vaincue. Bravo !', UiStyle.body(40, '#ffffff')).setOrigin(0.5);

        // Coop guest: the host picks what comes next, the guest can only leave
        if (Net.role === 'guest') {
            const waiting = this.add.text(centerX, 1250, "En attente de l'hôte...", UiStyle.body(44, '#ffffff')).setOrigin(0.5);
            this.tweens.add({targets: waiting, alpha: 0.3, duration: 600, yoyo: true, repeat: -1});
            this.time.delayedCall(GameOverScene.INPUT_DELAY_MS, () => {
                new Button(this, centerX, 1500, 'QUITTER LE SALON', () => {
                    Net.leave();
                    this.scene.start(GameConstants.SceneKeys.HOME);
                });
            });
            return;
        }

        // Buttons appear after a short delay so a finger still on the screen does not press one
        this.time.delayedCall(GameOverScene.INPUT_DELAY_MS, () => {
            let y = 1220;
            if (hasNextLevel) {
                new Button(this, centerX, y, 'NIVEAU SUIVANT', () => launchGame(this, this.saveManager, result.level + 1));
                y += 180;
            }
            new Button(this, centerX, y, 'REJOUER', () => launchGame(this, this.saveManager, result.level));
            new Button(this, centerX, y + 180, 'BOUTIQUE', () => this.scene.start(GameConstants.SceneKeys.SHOP));
            // Coop host: back to the room, the guests stay connected
            new Button(this, centerX, y + 360, Net.role === 'host' ? 'SALON' : 'MENU',
                () => this.scene.start(Net.role === 'host' ? GameConstants.SceneKeys.LOBBY : GameConstants.SceneKeys.HOME, {}));
        });

        // Ignore the OS key repeat: SPACE is often still held from shooting when the run ends
        this.input.keyboard?.on('keydown-SPACE', (event: KeyboardEvent) => {
            if (!event.repeat)
                launchGame(this, this.saveManager, hasNextLevel ? result.level + 1 : result.level);
        });
    }
}
