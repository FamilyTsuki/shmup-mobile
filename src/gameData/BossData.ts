import type {BulletJsonData} from "./BulletData.ts";
import type {Polarity, PolarityRule} from "./PolarityData.ts";

/**
 * Polarity of the bullets of a pattern. Omitted: the current boss polarity.
 * alternate: flips at each shot. counter: always the opposite of the player at the moment of the shot,
 * so the bullets can never be absorbed without switching.
 */
export type PatternPolarity = PolarityRule | 'counter';

export type BossOriginKey = 'mouth' | 'leftHand' | 'rightHand' | 'hands';

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
        polarity?: PatternPolarity;
        origin?: BossOriginKey;
    }
    /** Calls minions from enemies.json */
    | {
        type: 'summon';
        delayMs: number;
        enemy: string;
        count: number;
    }
    /** A row of bullets falling from the top of the screen, with one gap to fly through */
    | {
        type: 'curtain';
        delayMs: number;
        bullet: BulletJsonData;
        /** Width of the safe gap in px */
        gapWidth: number;
        /** Space between two bullets of the row in px */
        spacing: number;
        polarity?: PatternPolarity;
    }
    /** Bullets appear in a circle around the player, wait, then close in on where the player was */
    | {
        type: 'ring';
        delayMs: number;
        bullet: BulletJsonData;
        bulletCount: number;
        radius: number;
        holdMs: number;
        polarity?: PatternPolarity;
    }
    /** The boss flashes, then dashes at the player column and comes back. Contact hurts */
    | {
        type: 'lunge';
        delayMs: number;
        warnMs: number;
        /** Dash speed in px/ms */
        speed: number;
    }
    /** One big aimed bullet that flies back to the boss after a while */
    | {
        type: 'boomerang';
        delayMs: number;
        bullet: BulletJsonData;
        returnAfterMs: number;
        polarity?: PatternPolarity;
    }
    /** Still bullets placed around the screen for a while, away from the player */
    | {
        type: 'traps';
        delayMs: number;
        bullet: BulletJsonData;
        count: number;
        lifetimeMs: number;
        polarity?: PatternPolarity;
    }
    /**
     * Laser: a column lights up where the player is, then burns for durationMs. Moving sideways is the way out.
     * columns > 1 adds beams on each side, gap px apart.
     */
    | {
        type: 'beam';
        delayMs: number;
        warnMs: number;
        durationMs: number;
        /** Beam width in px, also the size of its bullets */
        width: number;
        columns?: number;
        gap?: number;
    }
    /** A fan of bullets swinging from side to side as they fly */
    | {
        type: 'snake';
        delayMs: number;
        bullet: BulletJsonData;
        bulletCount: number;
        spreadAngleDeg: number;
        aimed: boolean;
        /** Swing in px on each side, and swings per second */
        amplitude: number;
        frequency: number;
        polarity?: PatternPolarity;
        origin?: BossOriginKey;
    }
    /** Meteors falling from the top at random places, spread over spreadMs */
    | {
        type: 'rain';
        delayMs: number;
        bullet: BulletJsonData;
        count: number;
        spreadMs: number;
        polarity?: PatternPolarity;
    }
    /** Slow missiles that turn toward the player for a while, then fly straight */
    | {
        type: 'homing';
        delayMs: number;
        bullet: BulletJsonData;
        bulletCount: number;
        spreadAngleDeg: number;
        turnDegPerSec: number;
        homingMs: number;
        polarity?: PatternPolarity;
        origin?: BossOriginKey;
    };

export type BossPhaseData = {
    /** The phase starts when health ratio goes at or below this value; the first phase uses 1 */
    healthBelow: number;
    /** Movement speed multiplier for this phase */
    moveSpeedFactor: number;
    /** Polarity of the boss hull at the start of the phase: it takes more damage from the opposite one */
    polarity: Polarity;
    /** When set, the hull flips polarity every polarityCycleMs */
    polarityCycleMs?: number;
    /** Line the boss says when the phase starts */
    say?: string;
    patterns: BossPatternData[];
};

/**
 * sway: slow side to side swing around the screen center
 * duelist: quick jumps to random spots every repositionMs
 */
export type BossMovement = 'sway' | 'duelist';

export type BossData = {
    name: string;
    /** Ship shape drawn by TextureFactory, or a preloaded Phaser image key */
    texture: string;
    /** True when the texture is already drawn upright (no 90 deg rotation) */
    upright?: boolean;
    /** Normalized offsets (-0.5..0.5) relative to displayWidth/displayHeight for named attack origins */
    origins?: {
        mouth?: { x: number; y: number };
        leftHand?: { x: number; y: number };
        rightHand?: { x: number; y: number };
    };
    scale: number;
    health: number;
    score: number;
    /** Where the boss stops after entering the screen */
    entryY: number;
    movement?: BossMovement;
    /** sway: px on each side of the screen center. duelist: max distance of a jump */
    moveAmplitude: number;
    /** sway: angular speed in rad/ms. duelist: unused */
    moveSpeed: number;
    /** duelist: time between two jumps */
    repositionMs?: number;
    /** Lines said before the fight, one after the other; the boss cannot be hurt meanwhile */
    intro?: string[];
    /** Last words */
    defeatLine?: string;
    phases: BossPhaseData[];
};

export type BossesData = {
    [bossKey: string]: BossData;
};
