import {Scene} from "phaser";
import {emptyInputState, IInputSource, InputState} from "./InputState.ts";
import KeyboardInput from "./KeyboardInput.ts";
import TouchInput from "./TouchInput.ts";

/**
 * Merges every input device of this browser into a single player input.
 */
export default class LocalInput implements IInputSource {
    private readonly _sources: IInputSource[];

    constructor(scene: Scene) {
        this._sources = [new KeyboardInput(scene), new TouchInput(scene)];
    }

    public poll(): InputState {
        const merged = emptyInputState();

        for (const source of this._sources) {
            const state = source.poll();
            merged.moveX += state.moveX;
            merged.dragX += state.dragX;
            merged.rotate += state.rotate;
            merged.fire ||= state.fire;
        }

        merged.moveX = Phaser.Math.Clamp(merged.moveX, -1, 1);
        merged.rotate = Phaser.Math.Clamp(merged.rotate, -1, 1);

        return merged;
    }

    public destroy() {
        this._sources.forEach(source => source.destroy());
    }
}
