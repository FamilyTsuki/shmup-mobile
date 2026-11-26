import type {BulletJsonData} from "./BulletData.ts";

export type MovementData =
    | { type: 'straight' }
    /** Sideways oscillation, a spring pulling the enemy back to its spawn column */
    | { type: 'sine', frequency: number, amplitude: number }
    /** Slides toward the player column while diving, horizontalSpeed in px/ms */
    | { type: 'chase', horizontalSpeed: number }
    /** Stops at stopY, sways for stayMs, then leaves downward */
    | { type: 'hover', stopY: number, stayMs: number, swayAmplitude: number };

export type EnemyWeaponData = {
    bullet: BulletJsonData;
    bulletCount: number;
    spreadAngleDeg: number;
    /** Aim at the player instead of shooting straight ahead */
    aimed: boolean;
    /** Random delay between two shots, [min, max] in ms */
    fireDelayMs: [number, number];
};

export type EnemyData = {
    /** Ship shape drawn by TextureFactory, the polarity picks its color */
    texture: string;
    scale: number;
    health: number;
    /** Vertical speed in px/ms */
    speed: number;
    score: number;
    /** Chance in [0, 1] to drop a pickup on death */
    dropChance: number;
    /** The enemy swells this long before each shot, so the player can read it coming */
    telegraphMs: number;
    movement: MovementData;
    weapon?: EnemyWeaponData;
    /** Flips its polarity this often, blinking just before */
    polarityCycleMs?: number;
    /** Splits into these enemies when killed, one of each polarity in turn */
    split?: { enemy: string, count: number };
    /** A shield of its own color: only shots of the opposite polarity hurt it, the others bounce off */
    shielded?: boolean;
    /**
     * DANGER (orange): it rams the ship, its color always means "avoid". It takes the same damage from both
     * polarities, and its bullets, if any, always hurt.
     */
    hazard?: boolean;
};

/** Enemy and boss bullets fly faster on harder levels and endless stages, up to a cap */
export function bulletSpeedFactor(difficulty: number): number {
    return Math.min(1 + 0.12 * Math.max(0, difficulty - 1), 1.7);
}

export type EnemiesData = {
    [enemyType: string]: EnemyData;
};
