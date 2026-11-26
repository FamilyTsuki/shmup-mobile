/**
 * Snapshot of one player's intent for a frame. Plain data so it can later be sent over the network.
 */
export type InputState = {
    /** Analog horizontal axis in [-1, 1], scaled by the ship speed */
    moveX: number;
    /** Direct horizontal displacement in game pixels since the last poll (finger drag) */
    dragX: number;
    /** Analog vertical axis in [-1, 1], negative goes forward (up the screen) */
    moveY: number;
    /** Direct vertical displacement in game pixels since the last poll */
    dragY: number;
    /** Rotation axis in [-1, 1] */
    rotate: number;
    fire: boolean;
    /** True for the single poll right after the player asked to switch polarity */
    switchPolarity: boolean;
    /** Coop guest: the guest moved its ship itself, this is where it is. Overrides the other axes */
    absoluteX?: number;
    absoluteY?: number;
};

export interface IInputSource {
    poll(): InputState;
    destroy(): void;
}

export function emptyInputState(): InputState {
    return {moveX: 0, dragX: 0, moveY: 0, dragY: 0, rotate: 0, fire: false, switchPolarity: false};
}
