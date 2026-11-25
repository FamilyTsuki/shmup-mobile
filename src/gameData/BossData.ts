import type {BulletJsonData} from "./BulletData.ts";

export type BossPatternData =
    /** A fan of bullets; 360 deg with rotateDegPerShot makes a spiral */
    | {
        type: 'fan';
        delayMs: number;
        bullet: BulletJsonData;
        bulletCount: number;
        spreadAngleDeg: number;
        aimed: boolean;
        /** Turns the fan a bit more after each shot */
        rotateDegPerShot?: number;
    }
    /** Calls minions from enemies.json */
    | {
        type: 'summon';
        delayMs: number;
        enemy: string;
        count: number;
    };

export type BossPhaseData = {
    /** The phase starts when health ratio goes at or below this value; the first phase uses 1 */
    healthBelow: number;
    /** Sideways sway speed multiplier for this phase */
    moveSpeedFactor: number;
    patterns: BossPatternData[];
};

export type BossData = {
    name: string;
    texture: string;
    tint?: string;
    scale: number;
    health: number;
    score: number;
    /** Where the boss stops after entering the screen */
    entryY: number;
    /** Sideways sway in px on each side of the screen center */
    moveAmplitude: number;
    /** Sway angular speed in rad/ms */
    moveSpeed: number;
    phases: BossPhaseData[];
};

export type BossesData = {
    [bossKey: string]: BossData;
};
