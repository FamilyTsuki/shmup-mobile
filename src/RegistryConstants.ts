import {Data} from 'phaser';

export default class RegistryConstants {
    public static readonly Keys = Object.freeze({
        PLAYER_SCORE: 'playerScore',
        /** Current boss health in [0, 1], -1 when no boss is fighting */
        BOSS_HEALTH: 'bossHealth',
        BOSS_NAME: 'bossName',
    } as const);

    public static readonly Events = Object.freeze({
        PLAYER_SCORE_CHANGE: Data.Events.CHANGE_DATA_KEY + RegistryConstants.Keys.PLAYER_SCORE,
        BOSS_HEALTH_CHANGE: Data.Events.CHANGE_DATA_KEY + RegistryConstants.Keys.BOSS_HEALTH,
    } as const);
}