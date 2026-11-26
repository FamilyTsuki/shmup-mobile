import SaveManager from "./SaveManager.ts";
import SaveConstants from "../SaveConstants.ts";
import type {GyroSettings} from "../input/GyroInput.ts";
import type {Sound} from "phaser";
import AudioBus from "../audio/AudioBus.ts";

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
