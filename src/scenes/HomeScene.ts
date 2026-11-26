import {Loader} from "phaser";
import GameConstants from "../GameConstants.ts";
import SaveConstants from "../SaveConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";
import SaveManager from "../managers/SaveManager.ts";
import Settings from "../managers/Settings.ts";
import Progress from "../managers/Progress.ts";
import type {LevelsData} from "../gameData/LevelData.ts";
import launchGame from "./launchGame.ts";
import Button, {ButtonStyle} from "../ui/Button.ts";
import TextureFactory from "../utils/TextureFactory.ts";
import Backdrop from "../effects/Backdrop.ts";
import UiStyle from "../ui/UiStyle.ts";
import {POLARITY_STYLES} from "../gameData/PolarityData.ts";
import PlayerName from "../managers/PlayerName.ts";
import {newEndlessRun} from "../gameData/EndlessData.ts";
import BoardScene from "./BoardScene.ts";
import type {NameSceneData} from "./NameScene.ts";
import SampleBank from "../audio/SampleBank.ts";

export default class HomeScene extends Phaser.Scene {
    private static readonly MENU_BUTTON: ButtonStyle = {width: 640, height: 116, fontSize: 50, fillColor: UiStyle.PANEL};
    private static readonly FIRST_BUTTON_Y: number = 1090;
    private static readonly BUTTON_STEP: number = 140;

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

        this.load.image('omega_flowey', 'Bosses/omega_flowey.png');

        // Press Start 2P, SIL Open Font License (Fonts/PressStart2P-OFL.txt)
        this.load.font(UiStyle.FONT, 'Fonts/PressStart2P-Regular.ttf');
        this.load.json(GameConstants.DataKeys.PLAYER_SHIPS, 'Data/playerShips.json');
        this.load.json(GameConstants.DataKeys.ENEMIES, 'Data/enemies.json');
        this.load.json(GameConstants.DataKeys.LEVELS, 'Data/levels.json');
        this.load.json(GameConstants.DataKeys.BOSSES, 'Data/bosses.json');
        this.load.json(GameConstants.DataKeys.POWER_UPS, 'Data/powerups.json');
        this.load.json(GameConstants.DataKeys.UPGRADES, 'Data/upgrades.json');
        this.load.json(GameConstants.DataKeys.POLARITY, 'Data/polarity.json');
        this.load.json(GameConstants.DataKeys.COOP, 'Data/coop.json');
        this.load.json(GameConstants.DataKeys.ENDLESS, 'Data/endless.json');
        this.load.audio('sfx_laser1', 'Sounds/sfx_laser1.ogg');
        this.load.audio('sfx_laser2', 'Sounds/sfx_laser2.ogg');
    }

    create() {
        this.saveManager.load();
        TextureFactory.generate(this);
        RegistryConstants.initRunKeys(this.registry);
        Settings.applyAudio(this.saveManager, this.sound);
        SampleBank.render(this);

        const centerX = this.scale.width / 2;
        new Backdrop(this, 0.5);
        this.createTitle(centerX, 330);

        // The ship flips polarity on its own, to show what the game is about
        const ship = this.add.image(centerX, 770, TextureFactory.shipKey('arrow', 'ion')).setAngle(-90).setScale(2.4);
        const ring = this.add.image(centerX, 770, TextureFactory.RING_KEY).setScale(1.6).setAlpha(0.35)
            .setTint(POLARITY_STYLES.ion.color);
        let ion = true;
        this.time.addEvent({
            delay: 1400, loop: true, callback: () => {
                ion = !ion;
                const polarity = ion ? 'ion' : 'plasma';
                ship.setTexture(TextureFactory.shipKey('arrow', polarity));
                ring.setTint(POLARITY_STYLES[polarity].color).setScale(1.2).setAlpha(0.9);
                this.tweens.add({targets: ring, scale: 1.6, alpha: 0.35, duration: 500, ease: 'Cubic.easeOut'});
            }
        });
        this.tweens.add({targets: ship, y: 750, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'});

        const bestScore = Number(this.saveManager.getData(SaveConstants.Keys.PLAYER_BEST_SCORE) ?? 0);
        this.add.text(centerX, 520, `MEILLEUR SCORE  ${bestScore}`, UiStyle.text(40, '#ffe7a3', '#ffb347')).setOrigin(0.5);
        this.add.text(centerX, 1010, `$ ${Progress.getCredits(this.saveManager)}`,
            UiStyle.text(56, '#ffd166', '#ffb347')).setOrigin(0.5);

        // Tap the nickname to change it
        const name = PlayerName.get(this.saveManager);
        this.add.text(centerX, 590, name ? `PSEUDO  ${name}` : 'CHOISIR UN PSEUDO', UiStyle.body(36, '#9be0ec'))
            .setOrigin(0.5).setInteractive({useHandCursor: true})
            .on('pointerup', () => this.scene.start(GameConstants.SceneKeys.NAME, {next: 'home'} satisfies NameSceneData));

        const menu: [string, () => void][] = [
            ['INFINI', () => this.playEndless()],
            ['NIVEAUX', () => this.scene.start(GameConstants.SceneKeys.LEVEL_SELECT)],
            ['COOP', () => this.scene.start(GameConstants.SceneKeys.LOBBY, {})],
            ['BOUTIQUE', () => this.scene.start(GameConstants.SceneKeys.SHOP)],
            ['CLASSEMENT', () => this.scene.start(GameConstants.SceneKeys.BOARD)],
            ['OPTIONS', () => this.scene.start(GameConstants.SceneKeys.OPTIONS)],
        ];
        menu.forEach(([label, onClick], index) => new Button(this, centerX,
            HomeScene.FIRST_BUTTON_Y + index * HomeScene.BUTTON_STEP, label, onClick, HomeScene.MENU_BUTTON));

        const controls = Settings.getControls(this.saveManager);
        this.add.text(centerX, 1880, `Contrôle : ${controls.mode === 'gyro' ? 'gyroscope' : 'doigt'}`,
            UiStyle.body(36)).setOrigin(0.5);

        // A shared "?salon=1234" link goes straight to that coop room, once.
        // The QR code of the leaderboard ("?jam") goes to the nickname, then the endless mode.
        const params = new URLSearchParams(location.search);
        const room = params.get('salon');
        if (room || params.has(BoardScene.JAM_PARAM))
            history.replaceState(null, '', location.pathname);
        if (room)
            this.scene.start(GameConstants.SceneKeys.LOBBY, {join: room});
        else if (params.has(BoardScene.JAM_PARAM))
            this.scene.start(GameConstants.SceneKeys.NAME, {next: 'endless'} satisfies NameSceneData);

        // Keyboard shortcut: SPACE plays the furthest unlocked level. Ignore the OS key repeat.
        this.input.keyboard?.on('keydown-SPACE', (event: KeyboardEvent) => {
            if (!event.repeat)
                launchGame(this, this.saveManager, this.furthestLevel());
        });
    }

    /** "ION // PLASMA", each word in its polarity color */
    private createTitle(centerX: number, y: number) {
        const ion = this.add.text(0, 0, 'ION', UiStyle.text(130, POLARITY_STYLES.ion.lightCss, POLARITY_STYLES.ion.css));
        const slash = this.add.text(0, 0, ' // ', UiStyle.text(100, '#ffffff', UiStyle.CHROME_CSS));
        const plasma = this.add.text(0, 0, 'PLASMA',
            UiStyle.text(130, POLARITY_STYLES.plasma.lightCss, POLARITY_STYLES.plasma.css));
        // Shrink to fit the screen width with a margin
        const total = ion.width + slash.width + plasma.width;
        const scale = Math.min(1, (this.scale.width - 120) / total);
        let x = centerX - total * scale / 2;
        for (const word of [ion, slash, plasma]) {
            word.setOrigin(0, 0.5).setPosition(x, y).setScale(scale);
            x += word.width * scale;
        }
        this.add.text(centerX, y + 110, 'ABSORBE. BASCULE. RENVOIE.', UiStyle.text(34, '#ffffff', UiStyle.CHROME_CSS))
            .setOrigin(0.5);
    }

    /** The leaderboard needs a nickname: ask it once, before the first run */
    private playEndless() {
        if (PlayerName.get(this.saveManager))
            launchGame(this, this.saveManager, {endless: newEndlessRun()});
        else
            this.scene.start(GameConstants.SceneKeys.NAME, {next: 'endless'} satisfies NameSceneData);
    }

    private furthestLevel(): number {
        const levelCount = (this.cache.json.get(GameConstants.DataKeys.LEVELS) as LevelsData).levels.length;
        return Math.min(Progress.getUnlockedLevel(this.saveManager), levelCount - 1);
    }
}
