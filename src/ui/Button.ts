import {GameObjects, Input, Scene} from "phaser";
import UiStyle from "./UiStyle.ts";
import Sfx from "../audio/Sfx.ts";
import TextureFactory, {IconName} from "../utils/TextureFactory.ts";

export type ButtonStyle = {
    width: number;
    height: number;
    fontSize: number;
    fillColor: number;
};

/**
 * Large touch friendly button: reacts on release so a finger sliding off cancels the press.
 */
export default class Button extends GameObjects.Container {
    public static readonly DEFAULT_STYLE: ButtonStyle = Object.freeze({
        width: 640,
        height: 150,
        fontSize: 56,
        fillColor: UiStyle.PANEL,
    });

    /** Square button holding only an icon */
    public static readonly ICON_STYLE: ButtonStyle = Object.freeze({width: 170, height: 170, fontSize: 0, fillColor: UiStyle.PANEL});
    /** The main action of a screen, e.g. play again */
    public static readonly BIG_ICON_STYLE: ButtonStyle = Object.freeze({width: 240, height: 240, fontSize: 0, fillColor: UiStyle.PANEL});

    private static readonly PRESSED_SCALE: number = 0.94;
    private static readonly BORDER_COLOR: number = UiStyle.CHROME;
    private static readonly BORDER_WIDTH: number = 6;
    private static readonly SHADOW_OFFSET: number = 10;
    private static readonly SHADOW_COLOR: number = 0x0b0915;
    private static readonly DISABLED_ALPHA: number = 0.4;
    private static readonly HOVER_BORDER_COLOR: number = 0xffffff;
    private static readonly TAP_VIBRATION_MS: number = 8;

    private readonly _background: GameObjects.Rectangle;
    private readonly _label: GameObjects.Text;
    private _pressed: boolean = false;
    private _icon: GameObjects.Image | null = null;

    /** A button showing an icon instead of a word: less to read on small screens */
    public static icon(scene: Scene, x: number, y: number, icon: IconName, onClick: () => void,
                       style: ButtonStyle = Button.ICON_STYLE): Button {
        return new Button(scene, x, y, '', onClick, style).setIcon(icon);
    }

    constructor(scene: Scene, x: number, y: number, text: string, onClick: () => void,
                style: ButtonStyle = Button.DEFAULT_STYLE) {
        super(scene, x, y);

        // Flat retro panel: a hard shadow under a bordered box
        const shadow = scene.add.rectangle(0, Button.SHADOW_OFFSET, style.width, style.height, Button.SHADOW_COLOR);
        this._background = scene.add.rectangle(0, 0, style.width, style.height, style.fillColor)
            .setStrokeStyle(Button.BORDER_WIDTH, Button.BORDER_COLOR);
        this._label = scene.add.text(0, 0, UiStyle.plainCapitals(text), {...UiStyle.text(style.fontSize), align: 'center'})
            .setOrigin(0.5);
        this.add([shadow, this._background, this._label]);

        this.setSize(style.width, style.height);
        this.setInteractive({useHandCursor: true});

        const sfx = new Sfx(scene.sound);
        // Mouse: the border lights up under the cursor
        this.on(Input.Events.GAMEOBJECT_POINTER_OVER, () => this._background.setStrokeStyle(Button.BORDER_WIDTH, Button.HOVER_BORDER_COLOR));
        this.on(Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
            this._pressed = true;
            this.setScale(Button.PRESSED_SCALE);
        });
        this.on(Input.Events.GAMEOBJECT_POINTER_OUT, () => {
            this._background.setStrokeStyle(Button.BORDER_WIDTH, Button.BORDER_COLOR);
            this._pressed = false;
            this.setScale(1);
        });
        this.on(Input.Events.GAMEOBJECT_POINTER_UP, () => {
            if (!this._pressed)
                return;

            this._pressed = false;
            this.setScale(1);
            sfx.click();
            navigator.vibrate?.(Button.TAP_VIBRATION_MS);
            onClick();
        });

        scene.add.existing(this);
    }

    /** Icon buttons side by side, centered on the screen */
    public static iconRow(scene: Scene, y: number, buttons: [IconName, () => void][], gap: number = 230): Button[] {
        const firstX = scene.scale.width / 2 - (buttons.length - 1) * gap / 2;
        return buttons.map(([icon, onClick], index) => Button.icon(scene, firstX + index * gap, y, icon, onClick));
    }

    public setIcon(icon: IconName): this {
        const key = TextureFactory.iconKey(icon);
        if (this._icon) {
            this._icon.setTexture(key);
        } else {
            this._icon = this.scene.add.image(0, 0, key);
            this.add(this._icon);
        }
        // Bigger buttons, bigger icons
        this._icon.setScale(this.width / Button.ICON_STYLE.width * (this.width > Button.ICON_STYLE.width ? 1.25 : 1));
        return this;
    }

    public setText(text: string): this {
        this._label.setText(UiStyle.plainCapitals(text));
        return this;
    }

    public setEnabled(enabled: boolean): this {
        if (enabled)
            this.setInteractive();
        else
            this.disableInteractive();

        this.setAlpha(enabled ? 1 : Button.DISABLED_ALPHA);
        return this;
    }
}
