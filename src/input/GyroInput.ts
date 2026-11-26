import {emptyInputState, IInputSource, InputState} from "./InputState.ts";
import GyroSensor from "./GyroSensor.ts";

export type GyroSettings = {
    /** 1 = full speed at MAX_TILT_DEG, 2 = full speed at half that tilt */
    sensitivity: number;
    invert: boolean;
};

/**
 * Tilt the phone left/right to steer, forward/back to go up/down the screen.
 * Fires automatically: both hands hold the phone.
 */
export default class GyroInput implements IInputSource {
    private static readonly DEAD_ZONE_DEG: number = 2;
    private static readonly MAX_TILT_DEG: number = 25;
    // Share of the remaining distance to the target axis covered each poll, filters sensor noise
    private static readonly SMOOTHING: number = 0.3;

    /** Replaced when the player changes the options during a game */
    public settings: GyroSettings;
    private _axis: number = 0;
    private _axisY: number = 0;

    constructor(settings: GyroSettings) {
        this.settings = settings;
    }

    public poll(): InputState {
        const state = emptyInputState();
        if (!GyroSensor.hasData)
            return state;

        const tilt = GyroSensor.relativeTiltDeg * (this.settings.invert ? -1 : 1);
        this._axis += (this.axisFor(tilt) - this._axis) * GyroInput.SMOOTHING;
        // Top of the phone tipped away (pitch going down) moves the ship forward, up the screen
        this._axisY += (this.axisFor(GyroSensor.relativePitchDeg) - this._axisY) * GyroInput.SMOOTHING;

        state.moveX = this._axis;
        state.moveY = this._axisY;
        state.fire = true;

        return state;
    }

    /** Tilt in degrees to an axis in [-1, 1], with a dead zone around the neutral position */
    private axisFor(tiltDeg: number): number {
        const maxTilt = GyroInput.MAX_TILT_DEG / this.settings.sensitivity;
        const magnitude = Phaser.Math.Clamp(
            (Math.abs(tiltDeg) - GyroInput.DEAD_ZONE_DEG) / (maxTilt - GyroInput.DEAD_ZONE_DEG), 0, 1);
        return Math.sign(tiltDeg) * magnitude;
    }

    public destroy() {
        // The sensor listener is shared by the whole page and stays alive
    }
}
