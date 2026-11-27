import type {FormationType, LevelData, SpawnGroupData, WaveData} from "./LevelData.ts";
import type {PolarityRule} from "./PolarityData.ts";

/**
 * Tuning of the endless mode (endless.json): each stage is a level built at random, waves then a boss,
 * a bit harder than the previous one.
 */
export type EndlessData = {
    firstStageWaves: number;
    /** One more wave every this many stages */
    extraWavePerStages: number;
    maxWaves: number;
    difficultyStart: number;
    difficultyPerStage: number;
    maxGroupsPerWave: number;
    /** Enemies per group at stage 1, [min, max] */
    groupCount: [number, number];
    /** One more enemy per group every this many stages */
    extraEnemyPerStages: number;
    maxGroupCount: number;
    /** Cap for the formations that spawn every enemy at once (line, v) */
    maxAtOnceCount: number;
    /** Delay between two spawns of a group, [min, max] in ms */
    intervalMs: [number, number];
    /** Delay between the groups of a wave */
    groupDelayMs: number;
    /** First stage where each enemy type can appear */
    enemyUnlockStage: { [enemyType: string]: number };
    formations: FormationType[];
    polarities: PolarityRule[];
    /** Bosses in order, looping once every one was met */
    bossOrder: string[];
};

/** What an endless run carries from one stage to the next */
export type EndlessRun = {
    /** 1 for the first stage */
    stage: number;
    score: number;
    kills: number;
};

export function newEndlessRun(): EndlessRun {
    return {stage: 1, score: 0, kills: 0};
}

export function buildEndlessStage(data: EndlessData, stage: number): LevelData {
    const waveCount = Math.min(data.firstStageWaves + Math.floor((stage - 1) / data.extraWavePerStages), data.maxWaves);
    const waves: WaveData[] = [];
    for (let i = 0; i < waveCount; i++)
        waves.push(buildWave(data, stage, i));

    // First stage: the same lessons as level 1, for players who start with the endless mode
    if (stage === 1) {
        waves[0] = {...waves[0], waitFor: 'move', hint: 'Les tirs de TA couleur\nsont absorbés'};
        if (waves.length > 1)
            waves[1] = {...waves[1], waitFor: 'switch', hint: 'Bravo ! Change de couleur\npour absorber leurs tirs'};
    }

    return {
        name: `Etape ${stage}`,
        difficulty: data.difficultyStart + data.difficultyPerStage * (stage - 1),
        waves,
        boss: data.bossOrder[(stage - 1) % data.bossOrder.length],
    };
}

function buildWave(data: EndlessData, stage: number, waveIndex: number): WaveData {
    const enemies = Object.entries(data.enemyUnlockStage)
        .filter(([, unlockStage]) => unlockStage <= stage)
        .map(([type]) => type);
    // The first wave of a stage stays light, the last ones get busier
    const maxGroups = Math.min(1 + Math.floor((stage + waveIndex) / 2), data.maxGroupsPerWave);
    const groupCount = Phaser.Math.Between(1, maxGroups);
    const extra = Math.floor((stage - 1) / data.extraEnemyPerStages);

    const groups: SpawnGroupData[] = [];
    for (let i = 0; i < groupCount; i++) {
        const formation = Phaser.Utils.Array.GetRandom(data.formations);
        const atOnce = formation === 'line' || formation === 'v';
        const count = Math.min(Phaser.Math.Between(data.groupCount[0], data.groupCount[1]) + extra,
            atOnce ? data.maxAtOnceCount : data.maxGroupCount);
        groups.push({
            enemy: Phaser.Utils.Array.GetRandom(enemies),
            count,
            formation,
            intervalMs: Phaser.Math.Between(data.intervalMs[0], data.intervalMs[1]),
            delayMs: i * data.groupDelayMs,
            polarity: Phaser.Utils.Array.GetRandom(data.polarities),
        });
    }
    return {groups};
}
