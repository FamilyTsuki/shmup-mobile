import SaveManager from "./SaveManager.ts";
import SaveConstants from "../SaveConstants.ts";
import type {GyroSettings} from "../input/GyroInput.ts";
import type {Sound} from "phaser";
import AudioBus from "../audio/AudioBus.ts";
import GyroSensor from "../input/GyroSensor.ts";

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

    public static readonly VOLUME_STEP: number = 0.1;

    private static readonly DEFAULT_GYRO_SENSITIVITY: number = 1.5;
    private static readonly DEFAULT_MUSIC_VOLUME: number = 0.6;
    private static readonly DEFAULT_SFX_VOLUME: number = 0.8;

    /** A phone or a tablet: it can steer by tilting */
    public static isGyroDevice(): boolean {
        return navigator.maxTouchPoints > 0 && GyroSensor.isSupported;
    }

    /** True when the player picked the control mode in the options */
    public static isControlModeChosen(saveManager: SaveManager): boolean {
        return saveManager.getData(SaveConstants.Keys.CONTROL_MODE_CHOSEN) === true;
    }

    /**
     * Phones steer by tilting unless the player picked something else, or refused the sensor during this visit;
     * computers use the keyboard
     */
    private static defaultControlMode(): ControlMode {
        return Settings.isGyroDevice() && !GyroSensor.denied ? 'gyro' : 'touch';
    }

    public static getControls(saveManager: SaveManager): ControlSettings {
        const savedMode = saveManager.getData(SaveConstants.Keys.CONTROL_MODE);
        const chosen = Settings.isControlModeChosen(saveManager) && (savedMode === 'gyro' || savedMode === 'touch');
        const mode: ControlMode = chosen ? savedMode : Settings.defaultControlMode();
        return {
            // Refused sensor: the ship could not move, the finger takes over for this visit
            mode: mode === 'gyro' && GyroSensor.denied ? 'touch' : mode,
            gyro: {
                sensitivity: Number(saveManager.getData(SaveConstants.Keys.GYRO_SENSITIVITY)
                    ?? Settings.DEFAULT_GYRO_SENSITIVITY),
                invert: saveManager.getData(SaveConstants.Keys.GYRO_INVERT) === true,
                invertY: saveManager.getData(SaveConstants.Keys.GYRO_INVERT_Y) === true,
            }
        };
    }

    /** The player's choice in the options: kept from one visit to the next */
    public static setControlMode(saveManager: SaveManager, mode: ControlMode) {
        saveManager.setData(SaveConstants.Keys.CONTROL_MODE_CHOSEN, true, false);
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

    public static setGyroInvertY(saveManager: SaveManager, invert: boolean) {
        saveManager.setData(SaveConstants.Keys.GYRO_INVERT_Y, invert);
    }

    public static getMusicVolume(saveManager: SaveManager): number {
        return Number(saveManager.getData(SaveConstants.Keys.MUSIC_VOLUME) ?? Settings.DEFAULT_MUSIC_VOLUME);
    }

    public static getSfxVolume(saveManager: SaveManager): number {
        return Number(saveManager.getData(SaveConstants.Keys.SFX_VOLUME) ?? Settings.DEFAULT_SFX_VOLUME);
    }

    /** Rounded to the step so repeated taps don't drift */
    public static setMusicVolume(saveManager: SaveManager, volume: number) {
        saveManager.setData(SaveConstants.Keys.MUSIC_VOLUME, Settings.clampVolume(volume));
    }

    public static setSfxVolume(saveManager: SaveManager, volume: number) {
        saveManager.setData(SaveConstants.Keys.SFX_VOLUME, Settings.clampVolume(volume));
    }

    /** Mute, effects volume (Phaser's master volume) and music volume, from the save */
    public static applyAudio(saveManager: SaveManager, sound: Sound.BaseSoundManager) {
        sound.mute = !Settings.isSoundEnabled(saveManager);
        sound.volume = Settings.getSfxVolume(saveManager);
        AudioBus.get(sound)?.setMusicVolume(Settings.getMusicVolume(saveManager));
    }

    private static clampVolume(volume: number): number {
        return Math.round(Phaser.Math.Clamp(volume, 0, 1) * 10) / 10;
    }
}
