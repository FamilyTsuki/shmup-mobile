import SaveManager from "./SaveManager.ts";
import SaveConstants from "../SaveConstants.ts";
import type {GyroSettings} from "../input/GyroInput.ts";

export type ControlMode = 'touch' | 'gyro';

export type ControlSettings = {
    mode: ControlMode;
    gyro: GyroSettings;
};

/**
 * Typed access to the player preferences stored by the SaveManager.
 */
export default class Settings {
    public static readonly MIN_GYRO_SENSITIVITY: number = 0.5;
    public static readonly MAX_GYRO_SENSITIVITY: number = 2.5;
    public static readonly GYRO_SENSITIVITY_STEP: number = 0.25;

    private static readonly DEFAULT_GYRO_SENSITIVITY: number = 1;

    public static getControls(saveManager: SaveManager): ControlSettings {
        return {
            mode: saveManager.getData(SaveConstants.Keys.CONTROL_MODE) === 'gyro' ? 'gyro' : 'touch',
            gyro: {
                sensitivity: Number(saveManager.getData(SaveConstants.Keys.GYRO_SENSITIVITY)
                    ?? Settings.DEFAULT_GYRO_SENSITIVITY),
                invert: saveManager.getData(SaveConstants.Keys.GYRO_INVERT) === true,
            }
        };
    }

    public static setControlMode(saveManager: SaveManager, mode: ControlMode) {
        saveManager.setData(SaveConstants.Keys.CONTROL_MODE, mode);
    }

    public static setGyroSensitivity(saveManager: SaveManager, sensitivity: number) {
        saveManager.setData(SaveConstants.Keys.GYRO_SENSITIVITY, Phaser.Math.Clamp(sensitivity,
            Settings.MIN_GYRO_SENSITIVITY, Settings.MAX_GYRO_SENSITIVITY));
    }

    public static isSoundEnabled(saveManager: SaveManager): boolean {
        return saveManager.getData(SaveConstants.Keys.SOUND_ENABLED) !== false;
    }

    public static setSoundEnabled(saveManager: SaveManager, enabled: boolean) {
        saveManager.setData(SaveConstants.Keys.SOUND_ENABLED, enabled);
    }

    public static setGyroInvert(saveManager: SaveManager, invert: boolean) {
        saveManager.setData(SaveConstants.Keys.GYRO_INVERT, invert);
    }
}
