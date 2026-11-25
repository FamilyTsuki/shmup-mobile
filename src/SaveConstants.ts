export default class SaveConstants {
    public static readonly Keys = Object.freeze({
        PLAYER_BEST_SCORE: 'playerBestScore',
        CONTROL_MODE: 'controlMode',
        GYRO_SENSITIVITY: 'gyroSensitivity',
        GYRO_INVERT: 'gyroInvert',
    } as const);
}
