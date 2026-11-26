export default class SaveConstants {
    public static readonly Keys = Object.freeze({
        PLAYER_BEST_SCORE: 'playerBestScore',
        CONTROL_MODE: 'controlMode',
        /** True once the player picked the control mode in the options: it is not chosen for them any more */
        CONTROL_MODE_CHOSEN: 'controlModeChosen',
        GYRO_SENSITIVITY: 'gyroSensitivity',
        GYRO_INVERT: 'gyroInvert',
        /** Forward/back axis of the gyroscope */
        GYRO_INVERT_Y: 'gyroInvertY',
        SOUND_ENABLED: 'soundEnabled',
        /** 0..1 */
        MUSIC_VOLUME: 'musicVolume',
        /** 0..1 */
        SFX_VOLUME: 'sfxVolume',
        /** Credits in the bank, spent in the shop */
        CREDITS: 'credits',
        UPGRADE_LEVELS: 'upgradeLevels',
        /** Highest level index the player can start */
        UNLOCKED_LEVEL: 'unlockedLevel',
        SELECTED_SHIP: 'selectedShip',
        UNLOCKED_SHIPS: 'unlockedShips',
        /** Nickname on the endless mode leaderboard */
        PLAYER_NAME: 'playerName',
        /** Keys of the bosses whose intro the player has seen: a tap skips it next time */
        SEEN_BOSS_INTROS: 'seenBossIntros',
    } as const);
}
