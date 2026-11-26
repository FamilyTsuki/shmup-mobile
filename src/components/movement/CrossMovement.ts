import type Enemy from "../../entities/Enemy.ts";
import EnemyMovement from "./EnemyMovement.ts";

/**
 * Comes in from the left or the right side at a random height and flies straight across the screen,
 * leaving on the other side.
 */
export default class CrossMovement extends EnemyMovement {
    private readonly _minY: number;
    private readonly _maxY: number;
    private _direction: number = 1;

    constructor(minY: number, maxY: number) {
        super();
        this._minY = minY;
        this._maxY = maxY;
    }

    public reset(enemy: Enemy) {
        const width = enemy.scene.cameras.main.width;
        this._direction = Math.random() < 0.5 ? 1 : -1;
        // Just inside the margin where Enemy recycles what left the screen sideways
        enemy.x = this._direction > 0 ? -enemy.displayWidth * 0.4 : width + enemy.displayWidth * 0.4;
        enemy.y = Phaser.Math.Between(this._minY, this._maxY);
    }

    /** @param speed used sideways here */
    public update(enemy: Enemy, deltaTime: number, speed: number) {
        enemy.x += this._direction * speed * deltaTime;
    }
}
