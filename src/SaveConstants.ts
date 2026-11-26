export default class SaveConstants {
    public static readonly Keys = Object.freeze({
        PLAYER_BEST_SCORE: 'playerBestScore',
        CONTROL_MODE: 'controlMode',
        GYRO_SENSITIVITY: 'gyroSensitivity',
        GYRO_INVERT: 'gyroInvert',
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
    } as const);
}
