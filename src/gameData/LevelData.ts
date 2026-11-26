/**
 * random: each enemy at a random x, one every intervalMs
 * column: all enemies at the same random x, one every intervalMs
 * sides:  alternately on the left and right edges, one every intervalMs
 * line:   all at once, evenly spread across the screen
 * v:      all at once, in a V pointing down
 */
import type {PolarityRule} from "./PolarityData.ts";

export type FormationType = 'random' | 'column' | 'sides' | 'line' | 'v';

export type SpawnGroupData = {
    enemy: string;
    count: number;
    formation: FormationType;
    intervalMs: number;
    /** Wait before the first spawn of this group, from the wave start */
    delayMs?: number;
    /** Polarity of the spawned enemies, "alternate" when omitted */
    polarity?: PolarityRule;
};

export type WaveData = {
    groups: SpawnGroupData[];
    /** Shown with the wave banner, to teach a mechanic */
    hint?: string;
};

export type LevelData = {
    name: string;
    /** Multiplies enemy health and fire rate */
    difficulty: number;
    waves: WaveData[];
    /** Key in bosses.json */
    boss: string;
};

export type LevelsData = {
    levels: LevelData[];
};
