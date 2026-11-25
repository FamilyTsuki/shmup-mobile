import {GameObjects, Scenes, Scene} from "phaser";
import Health from "../components/Health.ts";
import Player from "../entities/Player.ts";
import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";
import Button from "../ui/Button.ts";

export default class MainUIScene extends Scene {
    private _playerHealthText: GameObjects.BitmapText;
    private _scoreText: GameObjects.BitmapText;
    private _bannerText: GameObjects.Text;
    private _comboText: GameObjects.Text;
    private _creditsText: GameObjects.Text;
    private _bombButton: Button;
    private _bossBar: GameObjects.Container;
    private _bossBarFill: GameObjects.Rectangle;
    private _bossNameText: GameObjects.Text;

    constructor() {
        super(GameConstants.SceneKeys.MAIN_UI);
    }

    // noinspection JSUnusedGlobalSymbols
    init() {
        this.game.events.on(GameConstants.Events.PLAYER_SPAWNED_EVENT, this.onPlayerSpawned, this);
        this.game.events.on(GameConstants.Events.BANNER_EVENT, this.showBanner, this);
        this.registry.events.on(RegistryConstants.Events.PLAYER_SCORE_CHANGE, this.onPlayerScoreChanged, this);
        this.registry.events.on(RegistryConstants.Events.BOSS_HEALTH_CHANGE, this.onBossHealthChanged, this);
        this.registry.events.on(RegistryConstants.Events.COMBO_CHANGE, this.onComboChanged, this);
        this.registry.events.on(RegistryConstants.Events.RUN_CREDITS_CHANGE, this.onCreditsChanged, this);
        this.registry.events.on(RegistryConstants.Events.BOMBS_CHANGE, this.onBombsChanged, this);

        this.events.once(Scenes.Events.SHUTDOWN, () => {
            this.game.events.off(GameConstants.Events.PLAYER_SPAWNED_EVENT, this.onPlayerSpawned, this);
            this.game.events.off(GameConstants.Events.BANNER_EVENT, this.showBanner, this);
            this.registry.events.off(RegistryConstants.Events.PLAYER_SCORE_CHANGE, this.onPlayerScoreChanged, this);
            this.registry.events.off(RegistryConstants.Events.BOSS_HEALTH_CHANGE, this.onBossHealthChanged, this);
            this.registry.events.off(RegistryConstants.Events.COMBO_CHANGE, this.onComboChanged, this);
            this.registry.events.off(RegistryConstants.Events.RUN_CREDITS_CHANGE, this.onCreditsChanged, this);
            this.registry.events.off(RegistryConstants.Events.BOMBS_CHANGE, this.onBombsChanged, this);
        }, this);
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        const playerHealthIcon = this.add.image(64, 64, "sprites", "playerLife1_blue")
            .setOrigin(0, 0).setScale(1.5);
        const playerHealthTextX = playerHealthIcon.x + playerHealthIcon.displayWidth + 16;
        this._playerHealthText = this.add.bitmapText(playerHealthTextX, 64, "future-bmp", "x0", 128);

        let scoreStr: string = "".padStart(GameConstants.MAX_SCORE_DIGITS, "0");
        if (this.registry.has(RegistryConstants.Keys.PLAYER_SCORE))
            scoreStr = this.registry.get(RegistryConstants.Keys.PLAYER_SCORE).toString()
                .padStart(GameConstants.MAX_SCORE_DIGITS, "0");
        this._scoreText = this.add.bitmapText(this.scale.width - 64, 64, "future-bmp", scoreStr, 128)
            .setOrigin(1, 0);

        new Button(this, this.scale.width / 2, 120, 'II',
            () => this.game.events.emit(GameConstants.Events.PAUSE_REQUESTED_EVENT),
            {width: 140, height: 140, fontSize: 56, fillColor: 0x3a2d5c}).setAlpha(0.7);

        this._bannerText = this.add.text(this.scale.width / 2, this.scale.height * 0.38, '',
            {fontSize: '88px', color: '#fff', fontFamily: 'future', align: 'center', stroke: '#000', strokeThickness: 10})
            .setOrigin(0.5).setAlpha(0);

        this._creditsText = this.add.text(this.scale.width - 64, 196, '$ 0',
            {fontSize: '44px', color: '#ffd166', fontFamily: 'future'}).setOrigin(1, 0);
        this._comboText = this.add.text(64, 196, '',
            {fontSize: '52px', color: '#ff8c42', fontFamily: 'future', stroke: '#000', strokeThickness: 6});

        this._bombButton = new Button(this, this.scale.width - 130, this.scale.height - 300, 'B',
            () => this.game.events.emit(GameConstants.Events.BOMB_REQUESTED_EVENT),
            {width: 170, height: 170, fontSize: 52, fillColor: 0x5a189a});
        this.onBombsChanged(null, Number(this.registry.get(RegistryConstants.Keys.BOMBS) ?? 0));

        this.createBossBar();

        this.scene.bringToTop();

        console.log("MainUIScene created");
    }

    private onComboChanged(_: any, multiplier: number) {
        this._comboText.setText(multiplier > 1 ? `COMBO X${multiplier}` : '');
        if (multiplier > 1) {
            this.tweens.killTweensOf(this._comboText);
            this._comboText.setScale(1.4);
            this.tweens.add({targets: this._comboText, scale: 1, duration: 200, ease: 'Back.easeOut'});
        }
    }

    private onCreditsChanged(_: any, credits: number) {
        this._creditsText.setText(`$ ${credits}`);
    }

    private onBombsChanged(_: any, bombs: number) {
        this._bombButton.setText(`B\n${bombs}`).setEnabled(bombs > 0);
    }

    private createBossBar() {
        const width = this.scale.width - 160;
        const background = this.add.rectangle(0, 0, width, 36, 0x000000, 0.6).setOrigin(0, 0.5)
            .setStrokeStyle(4, 0xffffff, 0.8);
        this._bossBarFill = this.add.rectangle(4, 0, width - 8, 26, 0xff4d6d).setOrigin(0, 0.5);
        this._bossNameText = this.add.text(width / 2, -44, '',
            {fontSize: '40px', color: '#fff', fontFamily: 'future', stroke: '#000', strokeThickness: 6}).setOrigin(0.5);
        this._bossBar = this.add.container(80, 240, [background, this._bossBarFill, this._bossNameText]).setVisible(false);
    }

    private onBossHealthChanged(_: any, ratio: number) {
        this._bossBar.setVisible(ratio >= 0);
        if (ratio < 0)
            return;

        this._bossNameText.setText(String(this.registry.get(RegistryConstants.Keys.BOSS_NAME) ?? '').toUpperCase());
        this._bossBarFill.scaleX = ratio;
    }

    private showBanner(text: string) {
        this.tweens.killTweensOf(this._bannerText);
        this._bannerText.setText(text).setAlpha(0).setScale(0.6);
        this.tweens.chain({
            targets: this._bannerText,
            tweens: [
                {alpha: 1, scale: 1, duration: 250, ease: 'Back.easeOut'},
                {alpha: 0, duration: 400, delay: 1300}
            ]
        });
    }

    private onPlayerScoreChanged(_: any, value: number) {
        const scoreStr: string = value.toString().padStart(GameConstants.MAX_SCORE_DIGITS, "0");
        this._scoreText.setText(scoreStr);
    }

    private onPlayerSpawned(player: Player) {
        this._playerHealthText.setText("x" + player.getComponent(Health)?.current);

        player.getComponent(Health)?.on(Health.CHANGE_EVENT, (current: number) => {
            this._playerHealthText.setText("x" + current);
        }, this);
    }
}