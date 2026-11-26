import {Input, Scene} from "phaser";
import {emptyInputState, IInputSource, InputState} from "./InputState.ts";
import GameConstants from "../GameConstants.ts";

/**
 * Relative drag: the ship follows the finger movement from wherever the finger is on screen,
 * so the finger never hides the ship. Firing is automatic while a finger is down.
 *
 * Switching polarity: a second finger tap, or a quick tap of the steering finger.
 * With tapToSwitch (gyroscope steering) any tap switches.
 */
export default class TouchInput implements IInputSource {
    private static readonly TAP_MAX_MS: number = 180;
    private static readonly TAP_MAX_DRAG: number = 24;

    private readonly _scene: Scene;
    /** Gyroscope steering: any tap switches polarity */
    public tapToSwitch: boolean;
    private _pointer: Input.Pointer | null = null;
    private _lastX: number = 0;
    private _lastY: number = 0;
    private _pendingDragX: number = 0;
    private _pendingDragY: number = 0;
    private _pendingSwitch: boolean = false;

    constructor(scene: Scene, tapToSwitch: boolean = false) {
        this._scene = scene;
        this.tapToSwitch = tapToSwitch;

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
        state.dragY = this._pendingDragY;
        state.fire = this._pointer !== null;
        state.switchPolarity = this._pendingSwitch;
        this._pendingDragX = 0;
        this._pendingDragY = 0;
        this._pendingSwitch = false;

        return state;
    }

    public destroy() {
        this._scene.input.off(Input.Events.POINTER_DOWN, this.onPointerDown, this);
        this._scene.input.off(Input.Events.POINTER_MOVE, this.onPointerMove, this);
        this._scene.input.off(Input.Events.POINTER_UP, this.onPointerUp, this);
    }

    /** Taps on the HUD buttons (pause, bomb) belong to the HUD */
    private isOverHud(pointer: Input.Pointer): boolean {
        const hud = this._scene.scene.get(GameConstants.SceneKeys.MAIN_UI);
        return hud !== null && hud.sys.isActive() && hud.input.hitTestPointer(pointer).length > 0;
    }

    private onPointerDown(pointer: Input.Pointer) {
        if (this.isOverHud(pointer))
            return;

        if (this.tapToSwitch) {
            this._pendingSwitch = true;
            return;
        }

        // The first finger steers, a second finger switches polarity
        if (this._pointer) {
            this._pendingSwitch = true;
            return;
        }

        this._pointer = pointer;
        this._lastX = pointer.x;
        this._lastY = pointer.y;
    }

    private onPointerMove(pointer: Input.Pointer) {
        if (pointer !== this._pointer)
            return;

        this._pendingDragX += pointer.x - this._lastX;
        this._pendingDragY += pointer.y - this._lastY;
        this._lastX = pointer.x;
        this._lastY = pointer.y;
    }

    private onPointerUp(pointer: Input.Pointer) {
        if (pointer !== this._pointer)
            return;

        // One thumb play: a quick tap without sliding switches too
        if (pointer.getDuration() < TouchInput.TAP_MAX_MS && pointer.getDistance() < TouchInput.TAP_MAX_DRAG)
            this._pendingSwitch = true;
        this._pointer = null;
    }
}
