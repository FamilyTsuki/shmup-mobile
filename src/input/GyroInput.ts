import {emptyInputState, IInputSource, InputState} from "./InputState.ts";
import GyroSensor from "./GyroSensor.ts";

export type GyroSettings = {
    /** 1 = full speed at MAX_TILT_DEG, 2 = full speed at half that tilt */
    sensitivity: number;
    invert: boolean;
};

/**
 * Tilt the phone to steer. Fires automatically: both hands hold the phone.
 */
export default class GyroInput implements IInputSource {
    private static readonly DEAD_ZONE_DEG: number = 2;
    private static readonly MAX_TILT_DEG: number = 25;
    // Share of the remaining distance to the target axis covered each poll, filters sensor noise
    private static readonly SMOOTHING: number = 0.3;

    private readonly _settings: GyroSettings;
    private _axis: number = 0;

    constructor(settings: GyroSettings) {
        this._settings = settings;
    }

    public poll(): InputState {
        const state = emptyInputState();
        if (!GyroSensor.hasData)
            return state;

        const tilt = GyroSensor.relativeTiltDeg * (this._settings.invert ? -1 : 1);
        const maxTilt = GyroInput.MAX_TILT_DEG / this._settings.sensitivity;
        const magnitude = Phaser.Math.Clamp(
            (Math.abs(tilt) - GyroInput.DEAD_ZONE_DEG) / (maxTilt - GyroInput.DEAD_ZONE_DEG), 0, 1);
        const target = Math.sign(tilt) * magnitude;

        this._axis += (target - this._axis) * GyroInput.SMOOTHING;

        state.moveX = this._axis;
        state.fire = true;

        return state;
    }

    public destroy() {
        // The sensor listener is shared by the whole page and stays alive
    }
}
