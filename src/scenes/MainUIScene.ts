import {GameObjects, Input, Scenes, Scene} from "phaser";
import Player from "../entities/Player.ts";
import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";
import Button from "../ui/Button.ts";
import UiStyle from "../ui/UiStyle.ts";
import TextureFactory from "../utils/TextureFactory.ts";
import Sfx from "../audio/Sfx.ts";
import Net from "../net/Net.ts";
import {oppositePolarity, Polarity, PolarityData, POLARITY_STYLES} from "../gameData/PolarityData.ts";

export default class MainUIScene extends Scene {
    private static readonly GAUGE_RADIUS: number = 78;
    private static readonly GAUGE_WIDTH: number = 16;
    private static readonly MAX_LIFE_ICONS: number = 8;
    /** Center of the dialogue box: right under the boss bar */
    private static readonly DIALOGUE_Y: number = 500;

    private _lifeIcons: GameObjects.Image[] = [];
    private _scoreText: GameObjects.Text;
    private _bannerText: GameObjects.Text;
    private _hintText: GameObjects.Text;
    private _comboText: GameObjects.Text;
    private _creditsText: GameObjects.Text;
    private _bombButton: Button;
    private _bossBar: GameObjects.Container;
    private _bossBarFill: GameObjects.Rectangle;
    private _bossNameText: GameObjects.Text;
    private _bossWeakText: GameObjects.Text;
    private _gauge: GameObjects.Container;
    private _gaugeGraphics: GameObjects.Graphics;
    private _gaugeLabel: GameObjects.Text;
    private _gaugeReady: GameObjects.Text;
    private _burstMinCharge: number = 0;
    private _dialogue: GameObjects.Container;
    private _dialogueName: GameObjects.Text;
    private _dialogueText: GameObjects.Text;
    private _dialogueSkip: GameObjects.Text;
    private _dialogueTimers: Phaser.Time.TimerEvent[] = [];
    private _sfx: Sfx;

    constructor() {
        super(GameConstants.SceneKeys.MAIN_UI);
    }

    // noinspection JSUnusedGlobalSymbols
    init() {
        this.registry.events.on(RegistryConstants.Events.LIVES_CHANGE, this.onLivesChanged, this);
        this.game.events.on(GameConstants.Events.BANNER_EVENT, this.showBanner, this);
        this.game.events.on(GameConstants.Events.HINT_EVENT, this.showHint, this);
        this.game.events.on(GameConstants.Events.DIALOGUE_EVENT, this.showDialogue, this);
        this.registry.events.on(RegistryConstants.Events.PLAYER_SCORE_CHANGE, this.onPlayerScoreChanged, this);
        this.registry.events.on(RegistryConstants.Events.BOSS_HEALTH_CHANGE, this.onBossHealthChanged, this);
        this.registry.events.on(RegistryConstants.Events.BOSS_POLARITY_CHANGE, this.onBossPolarityChanged, this);
        this.registry.events.on(RegistryConstants.Events.COMBO_CHANGE, this.onComboChanged, this);
        this.registry.events.on(RegistryConstants.Events.RUN_CREDITS_CHANGE, this.onCreditsChanged, this);
        this.registry.events.on(RegistryConstants.Events.BOMBS_CHANGE, this.onBombsChanged, this);
        this.registry.events.on(RegistryConstants.Events.RESONANCE_CHANGE, this.drawGauge, this);
        this.registry.events.on(RegistryConstants.Events.POLARITY_CHANGE, this.drawGauge, this);

        this.events.once(Scenes.Events.SHUTDOWN, () => {
            this.registry.events.off(RegistryConstants.Events.LIVES_CHANGE, this.onLivesChanged, this);
            this.game.events.off(GameConstants.Events.BANNER_EVENT, this.showBanner, this);
            this.game.events.off(GameConstants.Events.HINT_EVENT, this.showHint, this);
            this.game.events.off(GameConstants.Events.DIALOGUE_EVENT, this.showDialogue, this);
            this.registry.events.off(RegistryConstants.Events.PLAYER_SCORE_CHANGE, this.onPlayerScoreChanged, this);
            this.registry.events.off(RegistryConstants.Events.BOSS_HEALTH_CHANGE, this.onBossHealthChanged, this);
            this.registry.events.off(RegistryConstants.Events.BOSS_POLARITY_CHANGE, this.onBossPolarityChanged, this);
            this.registry.events.off(RegistryConstants.Events.COMBO_CHANGE, this.onComboChanged, this);
            this.registry.events.off(RegistryConstants.Events.RUN_CREDITS_CHANGE, this.onCreditsChanged, this);
            this.registry.events.off(RegistryConstants.Events.BOMBS_CHANGE, this.onBombsChanged, this);
            this.registry.events.off(RegistryConstants.Events.RESONANCE_CHANGE, this.drawGauge, this);
            this.registry.events.off(RegistryConstants.Events.POLARITY_CHANGE, this.drawGauge, this);
        }, this);
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        const {width, height} = this.scale;
        this._lifeIcons = [];
        for (let i = 0; i < MainUIScene.MAX_LIFE_ICONS; i++)
            this._lifeIcons.push(this.add.image(84 + i * 62, 96, TextureFactory.LIFE_KEY).setVisible(false));
        this.showLives(Number(this.registry.get(RegistryConstants.Keys.LIVES) ?? 0));

        const score = Number(this.registry.get(RegistryConstants.Keys.PLAYER_SCORE) ?? 0);
        this._scoreText = this.add.text(width - 64, 64, this.formatScore(score),
            UiStyle.text(76, '#ffffff', UiStyle.CHROME_CSS)).setOrigin(1, 0);

        new Button(this, width / 2, 110, 'II',
            () => this.game.events.emit(GameConstants.Events.PAUSE_REQUESTED_EVENT),
            {width: 120, height: 120, fontSize: 48, fillColor: UiStyle.PANEL}).setAlpha(0.75);

        this._bannerText = this.add.text(width / 2, height * 0.36, '',
            {...UiStyle.text(88, '#ffffff', UiStyle.CHROME_CSS), align: 'center'})
            .setOrigin(0.5).setAlpha(0);
        this._hintText = this.add.text(width / 2, height * 0.36 + 170, '',
            {...UiStyle.text(46, '#ffe7a3', '#ffb347'), align: 'center'})
            .setOrigin(0.5).setAlpha(0);

        this._creditsText = this.add.text(width - 64, 160, '$ 0', UiStyle.text(44, '#ffd166', '#ffb347')).setOrigin(1, 0);
        this._comboText = this.add.text(64, 160, '', UiStyle.text(52, '#ffb347', '#ff6b35'));

        // Controls live in a strip under the ship line, so they never cover it
        const stripHeight = GameConstants.HUD_STRIP_HEIGHT;
        const controlsY = height - stripHeight / 2;
        this.add.rectangle(0, height - stripHeight, width, stripHeight, 0x0b0915, 0.55).setOrigin(0);
        this.add.rectangle(0, height - stripHeight, width, 4, UiStyle.CHROME, 0.35).setOrigin(0);

        this._bombButton = new Button(this, width - 130, controlsY, 'B',
            () => this.game.events.emit(GameConstants.Events.BOMB_REQUESTED_EVENT),
            {width: 160, height: 160, fontSize: 44, fillColor: UiStyle.PANEL});
        this.onBombsChanged(null, Number(this.registry.get(RegistryConstants.Keys.BOMBS) ?? 0));

        this._burstMinCharge = (this.cache.json.get(GameConstants.DataKeys.POLARITY) as PolarityData).burst.minCharge;
        this.createGauge(130, controlsY);
        this.createBossBar();
        this.createDialogueBox();
        this._sfx = new Sfx(this.sound);

        this.scene.bringToTop();
    }

    /**
     * Resonance gauge around the polarity name. Also a button: tapping it switches polarity.
     */
    private createGauge(x: number, y: number) {
        const radius = MainUIScene.GAUGE_RADIUS;
        this._gaugeGraphics = this.add.graphics();
        this._gaugeLabel = this.add.text(0, -8, '', UiStyle.text(30, '#ffffff', UiStyle.CHROME_CSS)).setOrigin(0.5);
        this._gaugeReady = this.add.text(0, 30, 'BASCULE', UiStyle.text(22, '#ffffff', '#ffffff')).setOrigin(0.5);
        this._gauge = this.add.container(x, y, [this._gaugeGraphics, this._gaugeLabel, this._gaugeReady]);

        this._gauge.setInteractive(new Phaser.Geom.Circle(0, 0, radius + 20), Phaser.Geom.Circle.Contains);
        this._gauge.on(Input.Events.GAMEOBJECT_POINTER_DOWN,
            () => this.game.events.emit(GameConstants.Events.POLARITY_REQUESTED_EVENT));

        this.tweens.add({targets: this._gaugeReady, alpha: 0.3, duration: 350, yoyo: true, repeat: -1});
        this.drawGauge();
    }

    private drawGauge() {
        const polarity = (this.registry.get(RegistryConstants.Keys.POLARITY) ?? 'ion') as Polarity;
        const charge = Number(this.registry.get(RegistryConstants.Keys.RESONANCE) ?? 0);
        const style = POLARITY_STYLES[polarity];
        const radius = MainUIScene.GAUGE_RADIUS;
        const ready = charge >= this._burstMinCharge;

        const graphics = this._gaugeGraphics.clear();
        graphics.fillStyle(UiStyle.PANEL, 0.85).fillCircle(0, 0, radius);
        graphics.lineStyle(MainUIScene.GAUGE_WIDTH, 0xffffff, 0.08).strokeCircle(0, 0, radius - 4);
        if (charge > 0) {
            const start = -Math.PI / 2;
            graphics.lineStyle(MainUIScene.GAUGE_WIDTH, style.color, ready ? 1 : 0.6);
            graphics.beginPath().arc(0, 0, radius - 4, start, start + Math.PI * 2 * charge / 100).strokePath();
        }
        // Tick where the burst becomes available
        const tick = -Math.PI / 2 + Math.PI * 2 * this._burstMinCharge / 100;
        graphics.lineStyle(4, 0xffffff, 0.7).lineBetween(
            Math.cos(tick) * (radius - 16), Math.sin(tick) * (radius - 16),
            Math.cos(tick) * (radius + 8), Math.sin(tick) * (radius + 8));
        graphics.lineStyle(3, style.color, 0.9).strokeCircle(0, 0, radius - 22);

        this._gaugeLabel.setText(style.name).setColor(style.lightCss);
        // A full gauge overloads: same color bullets hurt until the player switches
        const overloaded = charge >= Player.MAX_CHARGE;
        this._gaugeReady.setVisible(ready)
            .setText(overloaded ? 'SURCHARGE' : 'BASCULE')
            .setColor(overloaded ? '#d9534f' : POLARITY_STYLES[oppositePolarity(polarity)].lightCss);
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
        const background = this.add.rectangle(0, 0, width, 36, UiStyle.PANEL, 0.8).setOrigin(0, 0.5)
            .setStrokeStyle(4, UiStyle.CHROME, 0.9);
        this._bossBarFill = this.add.rectangle(4, 0, width - 8, 26, POLARITY_STYLES.ion.color).setOrigin(0, 0.5);
        this._bossNameText = this.add.text(width / 2, -44, '', UiStyle.text(40, '#ffffff', UiStyle.CHROME_CSS)).setOrigin(0.5);
        this._bossWeakText = this.add.text(width / 2, 50, '', UiStyle.text(28, '#ffffff', '#ffffff')).setOrigin(0.5);
        this._bossBar = this.add.container(80, 260, [background, this._bossBarFill, this._bossNameText, this._bossWeakText])
            .setVisible(false);
    }

    private onBossHealthChanged(_: any, ratio: number) {
        this._bossBar.setVisible(ratio >= 0);
        if (ratio < 0)
            return;

        this._bossNameText.setText(UiStyle.upper(String(this.registry.get(RegistryConstants.Keys.BOSS_NAME) ?? '')));
        this._bossBarFill.scaleX = ratio;
        // The registry only notifies changes: read the hull polarity once the bar shows up
        this.onBossPolarityChanged(null, this.registry.get(RegistryConstants.Keys.BOSS_POLARITY) as Polarity);
    }

    /** The bar takes the hull color and tells which polarity hits it harder */
    private onBossPolarityChanged(_: any, polarity: Polarity) {
        const weakness = POLARITY_STYLES[oppositePolarity(polarity)];
        this._bossBarFill.setFillStyle(POLARITY_STYLES[polarity].color);
        this._bossWeakText.setText(`FAIBLE AU ${weakness.name}`).setColor(weakness.lightCss);
    }

    private showBanner(text: string) {
        this.tweens.killTweensOf(this._bannerText);
        this._bannerText.setText(UiStyle.upper(text)).setAlpha(0).setScale(0.6);
        this.tweens.chain({
            targets: this._bannerText,
            tweens: [
                {alpha: 1, scale: 1, duration: 250, ease: 'Back.easeOut'},
                {alpha: 0, duration: 400, delay: 1300}
            ]
        });
    }

    private createDialogueBox() {
        const {width} = this.scale;
        const boxWidth = width - 100;
        const boxHeight = 250;
        const shadow = this.add.rectangle(0, 10, boxWidth, boxHeight, 0x0b0915, 0.85);
        const panel = this.add.rectangle(0, 0, boxWidth, boxHeight, UiStyle.PANEL, 0.85).setStrokeStyle(6, 0xf4f1e8);
        this._dialogueName = this.add.text(-boxWidth / 2 + 30, -boxHeight / 2 - 18, '', UiStyle.text(40, '#f6d55c'))
            .setOrigin(0, 0.5);
        this._dialogueText = this.add.text(-boxWidth / 2 + 36, -boxHeight / 2 + 40, '',
            {...UiStyle.body(46, UiStyle.TEXT_CSS), wordWrap: {width: boxWidth - 72}, lineSpacing: 14});
        // Under the boss bar, far from the ships at the bottom of the screen
        this._dialogueSkip = this.add.text(boxWidth / 2 - 24, boxHeight / 2 - 22, 'TOUCHE POUR PASSER >',
            UiStyle.text(22, UiStyle.MUTED_CSS)).setOrigin(1, 1);
        this.tweens.add({targets: this._dialogueSkip, alpha: 0.35, duration: 600, yoyo: true, repeat: -1});
        this._dialogue = this.add.container(width / 2, MainUIScene.DIALOGUE_Y,
            [shadow, panel, this._dialogueName, this._dialogueText, this._dialogueSkip]).setVisible(false);
    }

    /**
     * Retro dialogue box: each line is typed letter by letter, then the next one replaces it.
     */
    /** @param skippable shows "tap to skip"; only the solo player or the host can */
    /**
     * @param y center of the box, right under the boss (set by the game scene); the default otherwise
     */
    private showDialogue(speaker: string, lines: string[], lineMs: number, skippable: boolean = false, y?: number) {
        this._dialogue.y = y ?? MainUIScene.DIALOGUE_Y;
        this._dialogueSkip.setVisible(skippable && Net.role !== 'guest');
        this._dialogueTimers.forEach(timer => timer.remove());
        this._dialogueTimers = [];
        if (lines.length === 0) {
            this._dialogue.setVisible(false);
            return;
        }
        this._dialogueName.setText(UiStyle.upper(speaker));
        this._dialogue.setVisible(true);

        lines.forEach((line, index) => {
            this._dialogueTimers.push(this.time.delayedCall(index * lineMs, () => this.typeLine(line, lineMs)));
        });
        this._dialogueTimers.push(this.time.delayedCall(lines.length * lineMs, () => this._dialogue.setVisible(false)));
    }

    private typeLine(line: string, lineMs: number) {
        const letters = [...UiStyle.plainCapitals(line)];
        // Type during the first half of the line time, read during the rest
        const letterMs = Math.min(40, lineMs / 2 / Math.max(1, letters.length));
        this._dialogueText.setText('');
        this._dialogueTimers.push(this.time.addEvent({
            delay: letterMs,
            repeat: letters.length - 1,
            callback: () => {
                const shown = this._dialogueText.text.length;
                this._dialogueText.setText(letters.slice(0, shown + 1).join(''));
                if (shown % 2 === 0 && letters[shown] !== ' ')
                    this._sfx.blip(0.9 + Math.random() * 0.2);
            }
        }));
    }

    private showHint(text: string) {
        this.tweens.killTweensOf(this._hintText);
        this._hintText.setText(UiStyle.plainCapitals(text)).setAlpha(0);
        this.tweens.chain({
            targets: this._hintText,
            tweens: [
                {alpha: 1, duration: 300, delay: 400},
                {alpha: 0, duration: 500, delay: 3200}
            ]
        });
    }

    private formatScore(value: number): string {
        return value.toString().padStart(GameConstants.MAX_SCORE_DIGITS, "0");
    }

    private onPlayerScoreChanged(_: any, value: number) {
        this._scoreText.setText(this.formatScore(value));
    }

    private showLives(lives: number) {
        this._lifeIcons.forEach((icon, index) => icon.setVisible(index < lives));
    }

    private onLivesChanged(_: any, lives: number) {
        this.showLives(lives);
    }
}
