import {Scene} from "phaser";
import {emptyInputState, IInputSource, InputState} from "./InputState.ts";
import GyroInput, {GyroSettings} from "./GyroInput.ts";
import KeyboardInput from "./KeyboardInput.ts";
import TouchInput from "./TouchInput.ts";

/**
 * Merges every input device of this browser into a single player input.
 */
export default class LocalInput implements IInputSource {
    private readonly _sources: IInputSource[];

    /**
     * @param gyro gyroscope settings, or undefined to steer without tilting the phone
     */
    constructor(scene: Scene, gyro?: GyroSettings) {
        // Tilting steers and fires: every tap is free to switch polarity
        this._sources = [new KeyboardInput(scene), new TouchInput(scene, gyro !== undefined)];
        if (gyro)
            this._sources.push(new GyroInput(gyro));
    }

    public poll(): InputState {
        const merged = emptyInputState();

        for (const source of this._sources) {
            const state = source.poll();
            merged.moveX += state.moveX;
            merged.dragX += state.dragX;
            merged.rotate += state.rotate;
            merged.fire ||= state.fire;
            merged.switchPolarity ||= state.switchPolarity;
        }

        merged.moveX = Phaser.Math.Clamp(merged.moveX, -1, 1);
        merged.rotate = Phaser.Math.Clamp(merged.rotate, -1, 1);

        return merged;
    }

    public destroy() {
        this._sources.forEach(source => source.destroy());
    }
}
