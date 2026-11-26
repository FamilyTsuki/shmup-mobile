import {Data} from 'phaser';

export default class RegistryConstants {
    public static readonly Keys = Object.freeze({
        PLAYER_SCORE: 'playerScore',
        /** Score multiplier of the current kill streak */
        COMBO: 'combo',
        /** Credits picked up during the current run */
        RUN_CREDITS: 'runCredits',
        KILLS: 'kills',
        BOMBS: 'bombs',
        /** Current boss health in [0, 1], -1 when no boss is fighting */
        BOSS_HEALTH: 'bossHealth',
        BOSS_NAME: 'bossName',
        /** Lives left of the player of this device */
        LIVES: 'lives',
        /** Player resonance gauge in [0, 100] */
        RESONANCE: 'resonance',
        /** Current player polarity: "ion" or "plasma" */
        POLARITY: 'polarity',
        /** Current boss hull polarity */
        BOSS_POLARITY: 'bossPolarity',
    } as const);

    public static readonly Events = Object.freeze({
        PLAYER_SCORE_CHANGE: Data.Events.CHANGE_DATA_KEY + RegistryConstants.Keys.PLAYER_SCORE,
        COMBO_CHANGE: Data.Events.CHANGE_DATA_KEY + RegistryConstants.Keys.COMBO,
        RUN_CREDITS_CHANGE: Data.Events.CHANGE_DATA_KEY + RegistryConstants.Keys.RUN_CREDITS,
        BOMBS_CHANGE: Data.Events.CHANGE_DATA_KEY + RegistryConstants.Keys.BOMBS,
        BOSS_HEALTH_CHANGE: Data.Events.CHANGE_DATA_KEY + RegistryConstants.Keys.BOSS_HEALTH,
        LIVES_CHANGE: Data.Events.CHANGE_DATA_KEY + RegistryConstants.Keys.LIVES,
        RESONANCE_CHANGE: Data.Events.CHANGE_DATA_KEY + RegistryConstants.Keys.RESONANCE,
        POLARITY_CHANGE: Data.Events.CHANGE_DATA_KEY + RegistryConstants.Keys.POLARITY,
        BOSS_POLARITY_CHANGE: Data.Events.CHANGE_DATA_KEY + RegistryConstants.Keys.BOSS_POLARITY,
    } as const);

    /**
     * Creates every run key up front: the HUD only listens to "changedata", which a brand new key does not emit.
     */
    public static initRunKeys(registry: Data.DataManager) {
        const defaults: { [key: string]: number | string } = {
            [RegistryConstants.Keys.PLAYER_SCORE]: 0,
            [RegistryConstants.Keys.COMBO]: 1,
            [RegistryConstants.Keys.RUN_CREDITS]: 0,
            [RegistryConstants.Keys.KILLS]: 0,
            [RegistryConstants.Keys.BOMBS]: 0,
            [RegistryConstants.Keys.BOSS_HEALTH]: -1,
            [RegistryConstants.Keys.RESONANCE]: 0,
            [RegistryConstants.Keys.LIVES]: 0,
            [RegistryConstants.Keys.POLARITY]: 'ion',
            [RegistryConstants.Keys.BOSS_POLARITY]: 'ion',
        };

        for (const [key, value] of Object.entries(defaults)) {
            if (!registry.has(key))
                registry.set(key, value);
        }
    }
}
