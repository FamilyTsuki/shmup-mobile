import {emptyInputState, IInputSource, InputState} from "../input/InputState.ts";
import type {NetInput} from "./Protocol.ts";
import Timeline from "./Timeline.ts";

/**
 * Host side input of a coop guest: fed by the guest's messages, read by its ship like a local input.
 * The ship position is replayed on a timeline, so it glides instead of jumping at each message.
 */
export default class NetworkInput implements IInputSource {
    /** How often a guest sends its input, see RemoteGameScene */
    public static readonly SEND_INTERVAL_MS: number = 1000 / 30;

    private readonly _timeline: Timeline<NetInput> = new Timeline(NetworkInput.SEND_INTERVAL_MS);
    private _pendingSwitches: number = 0;

    public receive(input: NetInput) {
        this._timeline.push(input.t, input);
        this._pendingSwitches += input.switches;
    }

    public poll(): InputState {
        const state = emptyInputState();
        const sample = this._timeline.sample();
        const latest = this._timeline.latest;
        if (!sample || !latest)
            return state;

        state.absoluteX = Phaser.Math.Linear(sample.older.x, sample.newer.x, sample.blend);
        // Firing and switching follow the latest message: no reason to delay them
        state.fire = latest.fire;
        // One switch per frame: two quick taps still give two switches, on two frames
        if (this._pendingSwitches > 0) {
            state.switchPolarity = true;
            this._pendingSwitches--;
        }
        return state;
    }

    public destroy() {
        this._timeline.clear();
    }
}
