import {Loader} from "phaser";
import GameConstants from "../GameConstants.ts";
import SaveConstants from "../SaveConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";
import SaveManager from "../managers/SaveManager.ts";
import Settings from "../managers/Settings.ts";
import Progress from "../managers/Progress.ts";
import type {LevelsData} from "../gameData/LevelData.ts";
import launchGame from "./launchGame.ts";
import Button from "../ui/Button.ts";
import TextureFactory from "../utils/TextureFactory.ts";

export default class HomeScene extends Phaser.Scene {
    private saveManager: SaveManager;

    constructor() {
        super(GameConstants.SceneKeys.HOME);
    }

    preload() {
        const width: number = this.scale.width;
        const y: number = this.scale.height / 2;

        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(0, y, width, 64);
        this.load.on(Loader.Events.PROGRESS, function (value: number) { // 0-1
            console.log("Loading : " + value);

            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(0, y, width * value, 64);
        });
        this.load.on(Loader.Events.COMPLETE, function () {
            console.log("Loading complete");

            progressBar.destroy();
            progressBox.destroy();
        });

        this.load.setPath('assets');

        this.load.image('bg', 'Backgrounds/darkPurple.png');
        this.load.image('planet', 'Planets/planet00.png');
        this.load.atlas('sprites', 'Spritesheet/gameSprites.png', 'Spritesheet/gameSprites.json');
        this.load.bitmapFont('future-bmp', 'Fonts/kenvector_future.png', 'Fonts/kenvector_future.xml');
        this.load.font('future', 'Fonts/kenvector_future.ttf');
        this.load.json(GameConstants.DataKeys.PLAYER_SHIPS, 'Data/playerShips.json');
        this.load.json(GameConstants.DataKeys.ENEMIES, 'Data/enemies.json');
        this.load.json(GameConstants.DataKeys.LEVELS, 'Data/levels.json');
        this.load.json(GameConstants.DataKeys.BOSSES, 'Data/bosses.json');
        this.load.json(GameConstants.DataKeys.POWER_UPS, 'Data/powerups.json');
        this.load.json(GameConstants.DataKeys.UPGRADES, 'Data/upgrades.json');
        this.load.audio('sfx_laser1', 'Sounds/sfx_laser1.ogg');
        this.load.audio('sfx_laser2', 'Sounds/sfx_laser2.ogg');
    }

    create() {
        this.saveManager.load();
        TextureFactory.generate(this);
        RegistryConstants.initRunKeys(this.registry);

        const centerX = this.scale.width / 2;
        this.add.image(centerX, 760, 'sprites', 'playerShip1_blue').setAngle(-90).setScale(2.2);
        this.add.text(centerX, 420, 'CODA SHMUP',
            {fontSize: '120px', color: '#fff', fontFamily: 'future'}).setOrigin(0.5);

        const bestScore = Number(this.saveManager.getData(SaveConstants.Keys.PLAYER_BEST_SCORE) ?? 0);
        this.add.text(centerX, 540, `Meilleur score : ${bestScore}`,
            {fontSize: '44px', color: '#ffe066', fontFamily: 'future'}).setOrigin(0.5);
        this.add.text(centerX, 1000, `$ ${Progress.getCredits(this.saveManager)}`,
            {fontSize: '56px', color: '#ffd166', fontFamily: 'future'}).setOrigin(0.5);

        new Button(this, centerX, 1180, 'JOUER', () => this.scene.start(GameConstants.SceneKeys.LEVEL_SELECT));
        new Button(this, centerX, 1370, 'BOUTIQUE', () => this.scene.start(GameConstants.SceneKeys.SHOP));
        new Button(this, centerX, 1560, 'OPTIONS', () => this.scene.start(GameConstants.SceneKeys.OPTIONS));

        const controls = Settings.getControls(this.saveManager);
        this.add.text(centerX, 1740, `Contrôle : ${controls.mode === 'gyro' ? 'gyroscope' : 'doigt'}`,
            {fontSize: '36px', color: '#bbb'}).setOrigin(0.5);

        // Keyboard shortcut: SPACE plays the furthest unlocked level. Ignore the OS key repeat.
        this.input.keyboard?.on('keydown-SPACE', (event: KeyboardEvent) => {
            if (!event.repeat)
                launchGame(this, this.saveManager, this.furthestLevel());
        });
    }

    private furthestLevel(): number {
        const levelCount = (this.cache.json.get(GameConstants.DataKeys.LEVELS) as LevelsData).levels.length;
        return Math.min(Progress.getUnlockedLevel(this.saveManager), levelCount - 1);
    }
}
