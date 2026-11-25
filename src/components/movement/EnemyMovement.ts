import type Enemy from "../../entities/Enemy.ts";
import IComponent from "../IComponent.ts";

/**
 * Moves an enemy each frame. Implementations keep their own state, cleared by reset() when a pooled enemy respawns.
 */
export default abstract class EnemyMovement implements IComponent {
    public enabled: boolean = true;

    public abstract reset(enemy: Enemy): void;

    /**
     * @param speed vertical speed in px/ms, already slowed down while the enemy flashes from a hit
     */
    public abstract update(enemy: Enemy, deltaTime: number, speed: number): void;
}
