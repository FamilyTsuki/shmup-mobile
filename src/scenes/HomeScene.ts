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
import Backdrop from "../effects/Backdrop.ts";
import UiStyle from "../ui/UiStyle.ts";
import {POLARITY_STYLES} from "../gameData/PolarityData.ts";

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
        this.load.audio('sfx_laser1', 'Sounds/sfx_laser1.ogg');
        this.load.audio('sfx_laser2', 'Sounds/sfx_laser2.ogg');
    }

    create() {
        this.saveManager.load();
        TextureFactory.generate(this);
        RegistryConstants.initRunKeys(this.registry);
        this.sound.mute = !Settings.isSoundEnabled(this.saveManager);

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

        new Button(this, centerX, 1120, 'JOUER', () => this.scene.start(GameConstants.SceneKeys.LEVEL_SELECT));
        new Button(this, centerX, 1290, 'COOP', () => this.scene.start(GameConstants.SceneKeys.LOBBY, {}));
        new Button(this, centerX, 1460, 'BOUTIQUE', () => this.scene.start(GameConstants.SceneKeys.SHOP));
        new Button(this, centerX, 1630, 'OPTIONS', () => this.scene.start(GameConstants.SceneKeys.OPTIONS));

        // A shared "?salon=1234" link goes straight to that coop room, once
        const room = new URLSearchParams(location.search).get('salon');
        if (room) {
            history.replaceState(null, '', location.pathname);
            this.scene.start(GameConstants.SceneKeys.LOBBY, {join: room});
        }

        const controls = Settings.getControls(this.saveManager);
        this.add.text(centerX, 1790, `Contrôle : ${controls.mode === 'gyro' ? 'gyroscope' : 'doigt'}`,
            UiStyle.body(36)).setOrigin(0.5);

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

    private furthestLevel(): number {
        const levelCount = (this.cache.json.get(GameConstants.DataKeys.LEVELS) as LevelsData).levels.length;
        return Math.min(Progress.getUnlockedLevel(this.saveManager), levelCount - 1);
    }
}
