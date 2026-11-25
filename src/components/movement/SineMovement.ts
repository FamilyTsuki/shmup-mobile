import type Enemy from "../../entities/Enemy.ts";
import EnemyMovement from "./EnemyMovement.ts";

/**
 * No Math.sin: a spring pulls the enemy back to its spawn column, the further the stronger.
 * Starting with velocity = amplitude * frequency makes it swing exactly amplitude px on each side.
 */
export default class SineMovement extends EnemyMovement {
    private readonly _frequency: number;
    private readonly _amplitude: number;
    private _offsetX: number = 0;
    private _velocityX: number = 0;

    constructor(frequency: number, amplitude: number) {
        super();
        this._frequency = frequency;
        this._amplitude = amplitude;
    }

    public reset(_enemy: Enemy) {
        this._offsetX = 0;
        this._velocityX = this._amplitude * this._frequency * (Math.random() < 0.5 ? -1 : 1);
    }

    public update(enemy: Enemy, deltaTime: number, speed: number) {
        enemy.y += speed * deltaTime;

        const acceleration = -this._frequency * this._frequency * this._offsetX;
        this._velocityX += acceleration * deltaTime;

        const step = this._velocityX * deltaTime;
        this._offsetX += step;
        enemy.x += step;
    }
}
