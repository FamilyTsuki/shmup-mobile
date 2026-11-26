import {Scene} from "phaser";
import {emptyInputState, IInputSource, InputState} from "./InputState.ts";

export default class KeyboardInput implements IInputSource {
    private readonly _keys?: Phaser.Types.Input.Keyboard.CursorKeys;
    private readonly _switchKey?: Phaser.Input.Keyboard.Key;

    constructor(scene: Scene) {
        this._keys = scene.input.keyboard?.createCursorKeys();
        this._switchKey = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    }

    public poll(): InputState {
        const state = emptyInputState();
        if (!this._keys)
            return state;

        const axis = (this._keys.right.isDown ? 1 : 0) - (this._keys.left.isDown ? 1 : 0);
        // Hold SHIFT to rotate the ship instead of moving it
        if (this._keys.shift.isDown)
            state.rotate = axis;
        else
            state.moveX = axis;
        state.moveY = (this._keys.down.isDown ? 1 : 0) - (this._keys.up.isDown ? 1 : 0);

        state.fire = this._keys.space.isDown;
        // X switches polarity, the arrows move
        state.switchPolarity = this._switchKey !== undefined && Phaser.Input.Keyboard.JustDown(this._switchKey);

        return state;
    }

    public destroy() {
        // Nothing to do: the scene keyboard plugin destroys its keys when the scene shuts down
    }
}
