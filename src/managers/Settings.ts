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

    private static readonly DEFAULT_GYRO_SENSITIVITY: number = 1.5;

    /** Phones steer by tilting until the player picks something else; computers use the keyboard */
    private static defaultControlMode(): ControlMode {
        return navigator.maxTouchPoints > 0 && 'DeviceOrientationEvent' in window ? 'gyro' : 'touch';
    }

    public static getControls(saveManager: SaveManager): ControlSettings {
        const savedMode = saveManager.getData(SaveConstants.Keys.CONTROL_MODE);
        return {
            mode: savedMode === 'gyro' || savedMode === 'touch' ? savedMode : Settings.defaultControlMode(),
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
