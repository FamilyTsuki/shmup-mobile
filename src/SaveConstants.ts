export default class SaveConstants {
    public static readonly Keys = Object.freeze({
        PLAYER_BEST_SCORE: 'playerBestScore',
        CONTROL_MODE: 'controlMode',
        GYRO_SENSITIVITY: 'gyroSensitivity',
        GYRO_INVERT: 'gyroInvert',
        SOUND_ENABLED: 'soundEnabled',
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
