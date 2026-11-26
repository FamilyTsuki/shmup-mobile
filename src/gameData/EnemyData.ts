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
};

export type EnemiesData = {
    [enemyType: string]: EnemyData;
};
