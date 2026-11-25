import {Input, Scene} from "phaser";
import {emptyInputState, IInputSource, InputState} from "./InputState.ts";

/**
 * Relative drag: the ship follows the finger movement from wherever the finger is on screen,
 * so the finger never hides the ship. Firing is automatic while a finger is down.
 */
export default class TouchInput implements IInputSource {
    private readonly _scene: Scene;
    private _pointer: Input.Pointer | null = null;
    private _lastX: number = 0;
    private _pendingDragX: number = 0;

    constructor(scene: Scene) {
        this._scene = scene;

        scene.input.on(Input.Events.POINTER_DOWN, this.onPointerDown, this);
        scene.input.on(Input.Events.POINTER_MOVE, this.onPointerMove, this);
        scene.input.on(Input.Events.POINTER_UP, this.onPointerUp, this);
    }

    public poll(): InputState {
        const state = emptyInputState();

        // A pointer released while the scene was paused never sent its POINTER_UP here
        if (this._pointer && !this._pointer.isDown)
            this._pointer = null;

        state.dragX = this._pendingDragX;
        state.fire = this._pointer !== null;
        this._pendingDragX = 0;

        return state;
    }

    public destroy() {
        this._scene.input.off(Input.Events.POINTER_DOWN, this.onPointerDown, this);
        this._scene.input.off(Input.Events.POINTER_MOVE, this.onPointerMove, this);
        this._scene.input.off(Input.Events.POINTER_UP, this.onPointerUp, this);
    }

    private onPointerDown(pointer: Input.Pointer) {
        // Only the first finger steers, extra fingers are ignored
        if (this._pointer)
            return;

        this._pointer = pointer;
        this._lastX = pointer.x;
    }

    private onPointerMove(pointer: Input.Pointer) {
        if (pointer !== this._pointer)
            return;

        this._pendingDragX += pointer.x - this._lastX;
        this._lastX = pointer.x;
    }

    private onPointerUp(pointer: Input.Pointer) {
        if (pointer === this._pointer)
            this._pointer = null;
    }
}
