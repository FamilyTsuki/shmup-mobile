import type Enemy from "../../entities/Enemy.ts";
import EnemyMovement from "./EnemyMovement.ts";

export default class StraightMovement extends EnemyMovement {
    public reset(_enemy: Enemy) {
    }

    public update(enemy: Enemy, deltaTime: number, speed: number) {
        enemy.y += speed * deltaTime;
    }
}
