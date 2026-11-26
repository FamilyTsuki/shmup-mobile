import {GameObjects, Scene} from "phaser";
import GameConstants from "../GameConstants.ts";
import type {LevelsData} from "../gameData/LevelData.ts";
import Progress from "../managers/Progress.ts";
import SaveManager from "../managers/SaveManager.ts";
import Button from "../ui/Button.ts";
import launchGame from "./launchGame.ts";
import Net from "../net/Net.ts";
import type {GameOverData} from "./MainGameScene.ts";
import {newEndlessRun} from "../gameData/EndlessData.ts";
import BoardScene from "./BoardScene.ts";
import Leaderboard from "../net/Leaderboard.ts";
import PlayerName from "../managers/PlayerName.ts";
import Backdrop from "../effects/Backdrop.ts";
import UiStyle from "../ui/UiStyle.ts";
import Music from "../audio/Music.ts";


/**
 * Results of a run, won or lost, and where to go next.
 */
export default class GameOverScene extends Scene {
    // The finger is usually still on the screen from playing when the run ends
    private static readonly INPUT_DELAY_MS: number = 800;
    private static readonly BOARD_ROWS: number = 8;
    private static readonly STINGER_MS: number = 4500;
    private static readonly BOARD_FIRST_ROW_Y: number = 960;
    private static readonly BOARD_ROW_HEIGHT: number = 62;

    private saveManager: SaveManager;

    constructor() {
        super(GameConstants.SceneKeys.GAME_OVER);
    }

    // noinspection JSUnusedGlobalSymbols
    create(result: GameOverData) {
        this.scene.stop(GameConstants.SceneKeys.MAIN_UI);
        Music.stinger(this.sound, result.victory ? 'victory' : 'defeat');
        // The menu theme comes back once the stinger has rung out, wherever the player went meanwhile
        this.time.delayedCall(GameOverScene.STINGER_MS, () => Music.play(this.sound, 'menu'));
        if (result.stage !== undefined) {
            this.createEndless(result);
            return;
        }

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
                // The shop goes back to the room; the host's next start pulls this player into the game from there
                new Button(this, centerX, 1400, 'BOUTIQUE COOP', () => this.scene.start(GameConstants.SceneKeys.SHOP));
                new Button(this, centerX, 1580, 'QUITTER LE SALON', () => {
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

    /**
     * Endless mode: score, rank and the top of the leaderboard, then play again.
     */
    private createEndless(result: GameOverData) {
        const centerX = this.scale.width / 2;
        new Backdrop(this, 0.5);
        this.add.text(centerX, 250, 'FIN DE PARTIE', UiStyle.text(110, '#ffffff', '#ff3d9a')).setOrigin(0.5);
        this.add.text(centerX, 370, PlayerName.get(this.saveManager), UiStyle.text(56, '#9be0ec')).setOrigin(0.5);

        const lines: [string, string][] = [
            ['SCORE', String(result.score)],
            ['ETAPE', String(result.stage)],
            ['CREDITS GAGNES', `+ ${result.credits}`],
        ];
        lines.forEach(([label, value], index) => {
            const y = 500 + index * 90;
            this.add.text(140, y, label, UiStyle.text(46, UiStyle.MUTED_CSS)).setOrigin(0, 0.5);
            this.add.text(this.scale.width - 140, y, value, UiStyle.text(52, '#ffd166', '#ffb347')).setOrigin(1, 0.5);
        });

        const rank = this.add.text(centerX, 800, 'Envoi du score...', UiStyle.text(52, '#ffe7a3', '#ffb347')).setOrigin(0.5);
        const rows: GameObjects.Text[] = [];
        for (let i = 0; i < GameOverScene.BOARD_ROWS; i++)
            rows.push(this.add.text(80, GameOverScene.BOARD_FIRST_ROW_Y + i * GameOverScene.BOARD_ROW_HEIGHT, '',
                UiStyle.text(40)).setOrigin(0, 0.5));

        // The rank comes first, so the top already holds this run
        (result.submitted ?? Promise.resolve(null)).then(async (submit) => {
            if (!this.scene.isActive())
                return;
            if (submit)
                rank.setText(submit.best ? `RANG #${submit.rank} !` : `RANG #${submit.rank} (ton record tient)`);
            else
                rank.setText(result.score > 0 ? 'Classement indisponible' : '');

            const top = await Leaderboard.top(GameOverScene.BOARD_ROWS);
            if (!this.scene.isActive() || !top)
                return;
            const name = PlayerName.get(this.saveManager);
            top.forEach((entry, index) => rows[index].setText(BoardScene.formatRow(index, entry))
                .setColor(entry.name === name ? '#9be0ec' : UiStyle.TEXT_CSS));
        });

        const replay = () => launchGame(this, this.saveManager, {endless: newEndlessRun()});
        this.time.delayedCall(GameOverScene.INPUT_DELAY_MS, () => {
            new Button(this, centerX, 1560, 'REJOUER', replay);
            new Button(this, centerX, 1740, 'MENU', () => this.scene.start(GameConstants.SceneKeys.HOME));
        });
        this.input.keyboard?.on('keydown-SPACE', (event: KeyboardEvent) => {
            if (!event.repeat)
                replay();
        });
    }
}
