import type {Scene} from "phaser";

/**
 * While a big message is on screen (wave banner, tutorial hint, boss dialogue) nobody fires:
 * neither the players, nor the enemies, nor the boss. The player can read without getting shot.
 * Stored in the scene data, so every entity of the game scene can check it.
 */
export default class CeaseFire {
    private static readonly UNTIL_KEY: string = 'ceaseFireUntil';
    private static readonly HELD_KEY: string = 'ceaseFireHeld';

    public static reset(scene: Scene) {
        scene.data.set(CeaseFire.UNTIL_KEY, 0);
        scene.data.set(CeaseFire.HELD_KEY, false);
    }

    /** Nobody fires for durationMs from now (extends a running cease fire, never shortens it) */
    public static hold(scene: Scene, durationMs: number) {
        const until = Number(scene.data.get(CeaseFire.UNTIL_KEY) ?? 0);
        scene.data.set(CeaseFire.UNTIL_KEY, Math.max(until, scene.time.now + durationMs));
    }

    /** Nobody fires until release() */
    public static holdUntilReleased(scene: Scene) {
        scene.data.set(CeaseFire.HELD_KEY, true);
    }

    /** Ends every cease fire right away, e.g. when a dialogue is skipped */
    public static release(scene: Scene) {
        CeaseFire.reset(scene);
    }

    public static isActive(scene: Scene): boolean {
        return scene.data.get(CeaseFire.HELD_KEY) === true
            || scene.time.now < Number(scene.data.get(CeaseFire.UNTIL_KEY) ?? 0);
    }
}
