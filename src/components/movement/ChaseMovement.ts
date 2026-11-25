import type Enemy from "../../entities/Enemy.ts";
import EnemyMovement from "./EnemyMovement.ts";

/**
 * Dives while sliding toward the player column, until it passes the player.
 */
export default class ChaseMovement extends EnemyMovement {
    private readonly _horizontalSpeed: number;

    constructor(horizontalSpeed: number) {
        super();
        this._horizontalSpeed = horizontalSpeed;
    }

    public reset(_enemy: Enemy) {
    }

    public update(enemy: Enemy, deltaTime: number, speed: number) {
        enemy.y += speed * deltaTime;

        const target = enemy.target;
        if (!target?.active || enemy.y > target.y)
            return;

        const maxStep = this._horizontalSpeed * deltaTime;
        enemy.x += Phaser.Math.Clamp(target.x - enemy.x, -maxStep, maxStep);
    }
}
