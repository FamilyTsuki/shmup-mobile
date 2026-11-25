import {Scene} from "phaser";
import GameConstants from "../GameConstants.ts";
import type {LevelsData} from "../gameData/LevelData.ts";
import Progress from "../managers/Progress.ts";
import SaveManager from "../managers/SaveManager.ts";
import Button from "../ui/Button.ts";
import launchGame from "./launchGame.ts";

export default class LevelSelectScene extends Scene {
    private static readonly FIRST_ROW_Y: number = 440;
    private static readonly ROW_HEIGHT: number = 230;

    private saveManager: SaveManager;

    constructor() {
        super(GameConstants.SceneKeys.LEVEL_SELECT);
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        const centerX = this.scale.width / 2;
        const levels = (this.cache.json.get(GameConstants.DataKeys.LEVELS) as LevelsData).levels;
        const unlocked = Progress.getUnlockedLevel(this.saveManager);

        this.add.text(centerX, 220, 'NIVEAUX', {fontSize: '110px', color: '#fff', fontFamily: 'future'}).setOrigin(0.5);

        levels.forEach((level, index) => {
            const y = LevelSelectScene.FIRST_ROW_Y + index * LevelSelectScene.ROW_HEIGHT;
            const locked = index > unlocked;
            const cleared = index < unlocked;
            const label = locked ? `${index + 1}. VERROUILLÉ` : `${index + 1}. ${level.name.toUpperCase()}`;

            new Button(this, centerX, y, label, () => launchGame(this, this.saveManager, index),
                {width: 900, height: 170, fontSize: 44, fillColor: cleared ? 0x2d5c3a : 0x3a2d5c})
                .setEnabled(!locked);
        });

        new Button(this, centerX, 1780, 'RETOUR', () => this.scene.start(GameConstants.SceneKeys.HOME));
    }
}
