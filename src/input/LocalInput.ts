import {Scene} from "phaser";
import {emptyInputState, IInputSource, InputState} from "./InputState.ts";
import GyroInput, {GyroSettings} from "./GyroInput.ts";
import KeyboardInput from "./KeyboardInput.ts";
import TouchInput from "./TouchInput.ts";

/**
 * Merges every input device of this browser into a single player input.
 */
export default class LocalInput implements IInputSource {
    private readonly _keyboard: KeyboardInput;
    private readonly _touch: TouchInput;
    private readonly _gyro: GyroInput;
    private _gyroEnabled: boolean = false;

    /**
     * @param gyro gyroscope settings, or undefined to steer without tilting the phone
     */
    constructor(scene: Scene, gyro?: GyroSettings) {
        this._keyboard = new KeyboardInput(scene);
        this._touch = new TouchInput(scene);
        this._gyro = new GyroInput(gyro ?? {sensitivity: 1, invert: false, invertY: false});
        this.applyControls(gyro);
    }

    private get sources(): IInputSource[] {
        return this._gyroEnabled ? [this._keyboard, this._touch, this._gyro] : [this._keyboard, this._touch];
    }

    /** Takes the new options into account, e.g. when the game resumes after the options screen */
    public applyControls(gyro?: GyroSettings) {
        // Tilting steers and fires: every tap is free to switch polarity
        this._touch.tapToSwitch = gyro !== undefined;
        this._gyroEnabled = gyro !== undefined;
        if (gyro)
            this._gyro.settings = gyro;
    }

    public poll(): InputState {
        const merged = emptyInputState();

        for (const source of this.sources) {
            const state = source.poll();
            merged.moveX += state.moveX;
            merged.dragX += state.dragX;
            merged.moveY += state.moveY;
            merged.dragY += state.dragY;
            merged.rotate += state.rotate;
            merged.fire ||= state.fire;
            merged.switchPolarity ||= state.switchPolarity;
        }

        merged.moveX = Phaser.Math.Clamp(merged.moveX, -1, 1);
        merged.moveY = Phaser.Math.Clamp(merged.moveY, -1, 1);
        merged.rotate = Phaser.Math.Clamp(merged.rotate, -1, 1);

        return merged;
    }

    public destroy() {
        [this._keyboard, this._touch, this._gyro].forEach(source => source.destroy());
    }
}
