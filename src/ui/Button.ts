import {GameObjects, Input, Scene} from "phaser";

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
        fillColor: 0x3a2d5c,
    });

    private static readonly PRESSED_SCALE: number = 0.94;
    private static readonly BORDER_COLOR: number = 0xffffff;
    private static readonly DISABLED_ALPHA: number = 0.4;

    private readonly _background: GameObjects.Rectangle;
    private readonly _label: GameObjects.Text;
    private _pressed: boolean = false;

    constructor(scene: Scene, x: number, y: number, text: string, onClick: () => void,
                style: ButtonStyle = Button.DEFAULT_STYLE) {
        super(scene, x, y);

        this._background = scene.add.rectangle(0, 0, style.width, style.height, style.fillColor)
            .setStrokeStyle(6, Button.BORDER_COLOR, 0.8);
        this._label = scene.add.text(0, 0, text,
            {fontSize: `${style.fontSize}px`, color: '#fff', fontFamily: 'future', align: 'center'}).setOrigin(0.5);
        this.add([this._background, this._label]);

        this.setSize(style.width, style.height);
        this.setInteractive({useHandCursor: true});

        this.on(Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
            this._pressed = true;
            this.setScale(Button.PRESSED_SCALE);
        });
        this.on(Input.Events.GAMEOBJECT_POINTER_OUT, () => {
            this._pressed = false;
            this.setScale(1);
        });
        this.on(Input.Events.GAMEOBJECT_POINTER_UP, () => {
            if (!this._pressed)
                return;

            this._pressed = false;
            this.setScale(1);
            onClick();
        });

        scene.add.existing(this);
    }

    public setText(text: string): this {
        this._label.setText(text);
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
