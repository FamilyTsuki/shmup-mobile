import type Enemy from "../../entities/Enemy.ts";
import EnemyMovement from "./EnemyMovement.ts";

/**
 * Comes down to stopY, sways in place for a while, then leaves the screen downward.
 */
export default class HoverMovement extends EnemyMovement {
    private static readonly SWAY_SPEED: number = 0.0015;

    private readonly _stopY: number;
    private readonly _stayMs: number;
    private readonly _swayAmplitude: number;
    private _stayedMs: number = 0;
    private _anchorX: number = 0;

    constructor(stopY: number, stayMs: number, swayAmplitude: number) {
        super();
        this._stopY = stopY;
        this._stayMs = stayMs;
        this._swayAmplitude = swayAmplitude;
    }

    public reset(enemy: Enemy) {
        this._stayedMs = 0;
        this._anchorX = enemy.x;
    }

    public update(enemy: Enemy, deltaTime: number, speed: number) {
        const arrived = enemy.y >= this._stopY;
        if (!arrived || this._stayedMs >= this._stayMs) {
            enemy.y += speed * deltaTime;
            return;
        }

        this._stayedMs += deltaTime;
        enemy.x = this._anchorX + Math.sin(this._stayedMs * HoverMovement.SWAY_SPEED) * this._swayAmplitude;
    }
}
