import {GameObjects, Loader} from "phaser";
import GameConstants from "../GameConstants.ts";
import SaveConstants from "../SaveConstants.ts";
import GyroSensor from "../input/GyroSensor.ts";
import SaveManager from "../managers/SaveManager.ts";
import Settings from "../managers/Settings.ts";
import Button from "../ui/Button.ts";

export default class HomeScene extends Phaser.Scene {
    private static readonly FALLBACK_MESSAGE_MS: number = 1500;

    private saveManager: SaveManager;
    private _messageText: GameObjects.Text;
    private _starting: boolean;

    constructor() {
        super(GameConstants.SceneKeys.HOME);
    }

    init() {
        this._starting = false;
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
        this.load.json('playerShips', 'Data/playerShips.json');
        this.load.json(GameConstants.DataKeys.ENEMIES, 'Data/enemies.json');
        this.load.json(GameConstants.DataKeys.LEVELS, 'Data/levels.json');
        this.load.json(GameConstants.DataKeys.BOSSES, 'Data/bosses.json');
        this.load.audio('sfx_laser1', 'Sounds/sfx_laser1.ogg');
        this.load.audio('sfx_laser2', 'Sounds/sfx_laser2.ogg');
    }

    create() {
        this.saveManager.load();

        const centerX = this.scale.width / 2;
        this.add.text(centerX, 520, 'CODA SHMUP',
            {fontSize: '120px', color: '#fff', fontFamily: 'future'}).setOrigin(0.5);

        const bestScore = Number(this.saveManager.getData(SaveConstants.Keys.PLAYER_BEST_SCORE) ?? 0);
        this.add.text(centerX, 660, `Meilleur score : ${bestScore}`,
            {fontSize: '48px', color: '#ffe066', fontFamily: 'future'}).setOrigin(0.5);

        new Button(this, centerX, 1050, 'JOUER', () => this.startGame());
        new Button(this, centerX, 1250, 'OPTIONS', () => this.scene.start(GameConstants.SceneKeys.OPTIONS));

        const controls = Settings.getControls(this.saveManager);
        this._messageText = this.add.text(centerX, 1450,
            `Contrôle : ${controls.mode === 'gyro' ? 'gyroscope' : 'doigt'}`,
            {fontSize: '40px', color: '#bbb', align: 'center'}).setOrigin(0.5);

        // Ignore the OS key repeat: SPACE may still be held from the previous game
        this.input.keyboard?.on('keydown-SPACE', (event: KeyboardEvent) => {
            if (event.repeat)
                return;

            this.startGame();
        });
    }

    private startGame() {
        if (this._starting)
            return;
        this._starting = true;

        // Both requests need the tap gesture that is being handled right now
        if (this.sys.game.device.input.touch && this.scale.fullscreen.available && !this.scale.isFullscreen)
            this.scale.startFullscreen();

        if (Settings.getControls(this.saveManager).mode !== 'gyro') {
            this.launchGame();
            return;
        }

        GyroSensor.requestAccess().then((granted) => {
            if (!granted) {
                // Without the sensor the ship could not move: fall back to touch for this device
                Settings.setControlMode(this.saveManager, 'touch');
                this._messageText.setText('Gyroscope refusé ou absent\ncontrôle au doigt');
                this.time.delayedCall(HomeScene.FALLBACK_MESSAGE_MS, () => this.launchGame());
                return;
            }

            this.launchGame();
        });
    }

    private launchGame() {
        this.scene.launch(GameConstants.SceneKeys.MAIN_UI);
        this.scene.start(GameConstants.SceneKeys.MAIN_GAME);
    }
}
