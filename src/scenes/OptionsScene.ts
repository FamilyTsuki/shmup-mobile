import {GameObjects, Scene} from "phaser";
import GameConstants from "../GameConstants.ts";
import GyroInput from "../input/GyroInput.ts";
import GyroSensor from "../input/GyroSensor.ts";
import SaveManager from "../managers/SaveManager.ts";
import Settings from "../managers/Settings.ts";
import Button, {ButtonStyle} from "../ui/Button.ts";
import Backdrop from "../effects/Backdrop.ts";
import UiStyle from "../ui/UiStyle.ts";
import Sfx from "../audio/Sfx.ts";

export type OptionsSceneData = {
    /** Opened from the pause menu: RETOUR wakes this sleeping scene instead of going to the title */
    returnTo?: string;
};

export default class OptionsScene extends Scene {
    private static readonly SMALL_BUTTON: ButtonStyle = {width: 130, height: 130, fontSize: 64, fillColor: UiStyle.PANEL};
    private static readonly HALF_BUTTON: ButtonStyle = {width: 470, height: 130, fontSize: 40, fillColor: UiStyle.PANEL};
    /** Side of the square showing the gyroscope live, both axes */
    private static readonly TILT_PAD_SIZE: number = 280;
    private static readonly TILT_PAD_Y: number = 1530;

    private saveManager: SaveManager;
    private _modeButton: Button;
    private _invertButton: Button;
    private _invertYButton: Button;
    private _soundButton: Button;
    private _sensitivityText: GameObjects.Text;
    private _musicText: GameObjects.Text;
    private _sfxText: GameObjects.Text;
    private _messageText: GameObjects.Text;
    private _tiltCursor: GameObjects.Rectangle;
    private _tiltPad: GameObjects.Container;
    private _gyroPreview: GyroInput | null;

    constructor() {
        super(GameConstants.SceneKeys.OPTIONS);
    }

    // noinspection JSUnusedGlobalSymbols
    create(data?: OptionsSceneData) {
        const centerX = this.scale.width / 2;
        const returnTo = data?.returnTo;
        new Backdrop(this, 0.5);

        this.add.text(centerX, 150, 'OPTIONS', UiStyle.text(110)).setOrigin(0.5);

        this._soundButton = Button.icon(this, centerX, 300, 'soundOn', () => {
            Settings.setSoundEnabled(this.saveManager, !Settings.isSoundEnabled(this.saveManager));
            Settings.applyAudio(this.saveManager, this.sound);
            this.refresh();
        });

        const sfx = new Sfx(this.sound);
        this._musicText = this.addStepper(440, 'Musique', (delta) => {
            Settings.setMusicVolume(this.saveManager, Settings.getMusicVolume(this.saveManager) + delta);
        });
        this._sfxText = this.addStepper(650, 'Effets', (delta) => {
            Settings.setSfxVolume(this.saveManager, Settings.getSfxVolume(this.saveManager) + delta);
            // Hear the new level right away (the button click plays before the change)
            this.time.delayedCall(120, () => sfx.coin());
        });

        this._modeButton = new Button(this, centerX, 900, '', () => this.toggleMode());

        this._sensitivityText = this.addStepper(1040, 'Sensibilité gyroscope',
            (delta) => this.changeSensitivity(delta * Settings.GYRO_SENSITIVITY_STEP / Settings.VOLUME_STEP));

        this._invertButton = new Button(this, centerX - 245, 1290, '', () => this.toggleInvert(),
            OptionsScene.HALF_BUTTON);
        this._invertYButton = new Button(this, centerX + 245, 1290, '', () => this.toggleInvertY(),
            OptionsScene.HALF_BUTTON);

        // Live preview of both gyroscope axes, to feel the sensitivity before playing:
        // tilt left/right moves the dot sideways, forward/back moves it up and down
        const size = OptionsScene.TILT_PAD_SIZE;
        this._tiltCursor = this.add.rectangle(0, 0, 40, 40, 0xffe066);
        this._tiltPad = this.add.container(centerX, OptionsScene.TILT_PAD_Y, [
            this.add.rectangle(0, 0, size, size, UiStyle.PANEL).setStrokeStyle(6, UiStyle.CHROME),
            this.add.rectangle(0, 0, size - 12, 4, 0xffffff, 0.25),
            this.add.rectangle(0, 0, 4, size - 12, 0xffffff, 0.25),
            this._tiltCursor,
        ]);
        Button.icon(this, centerX + size / 2 + 150, OptionsScene.TILT_PAD_Y, 'target', () => {
            GyroSensor.calibrate();
            this._messageText.setText('Position actuelle = tout droit');
        });

        this._messageText = this.add.text(centerX, 1712, '', UiStyle.body(34, '#bbbbbb'))
            .setOrigin(0.5);

        Button.icon(this, centerX, 1830, 'back', () => {
            if (!returnTo) {
                this.scene.start(GameConstants.SceneKeys.HOME);
                return;
            }
            this.game.events.emit(GameConstants.Events.CONTROLS_CHANGED_EVENT);
            this.scene.stop();
            this.scene.wake(returnTo);
        });

        this.refresh();
        this.scene.bringToTop();
    }

    /**
     * A label, then "-  value  +".
     * @param onStep called with -VOLUME_STEP or +VOLUME_STEP
     * @returns the value text, filled by refresh()
     */
    private addStepper(labelY: number, label: string, onStep: (delta: number) => void): GameObjects.Text {
        const centerX = this.scale.width / 2;
        const rowY = labelY + 90;
        this.add.text(centerX, labelY, label, UiStyle.body(44, UiStyle.TEXT_CSS)).setOrigin(0.5);
        const step = (delta: number) => {
            onStep(delta);
            Settings.applyAudio(this.saveManager, this.sound);
            this.refresh();
        };
        new Button(this, centerX - 300, rowY, '-', () => step(-Settings.VOLUME_STEP), OptionsScene.SMALL_BUTTON);
        new Button(this, centerX + 300, rowY, '+', () => step(Settings.VOLUME_STEP), OptionsScene.SMALL_BUTTON);
        return this.add.text(centerX, rowY, '', UiStyle.text(64, '#f6d55c')).setOrigin(0.5);
    }

    update() {
        const state = this._gyroPreview?.poll();
        const reach = (OptionsScene.TILT_PAD_SIZE - 40) / 2;
        this._tiltCursor.setPosition((state?.moveX ?? 0) * reach, (state?.moveY ?? 0) * reach);
    }

    private toggleMode() {
        if (Settings.getControls(this.saveManager).mode === 'gyro') {
            Settings.setControlMode(this.saveManager, 'touch');
            this.refresh();
            return;
        }

        GyroSensor.requestAccess().then((granted) => {
            if (granted)
                Settings.setControlMode(this.saveManager, 'gyro');
            else
                this._messageText.setText('Gyroscope refusé ou absent');

            this.refresh();
        });
    }

    private changeSensitivity(delta: number) {
        const controls = Settings.getControls(this.saveManager);
        Settings.setGyroSensitivity(this.saveManager, controls.gyro.sensitivity + delta);
        this.refresh();
    }

    private toggleInvertY() {
        Settings.setGyroInvertY(this.saveManager, !Settings.getControls(this.saveManager).gyro.invertY);
        this.refresh();
    }

    private toggleInvert() {
        Settings.setGyroInvert(this.saveManager, !Settings.getControls(this.saveManager).gyro.invert);
        this.refresh();
    }

    private refresh() {
        const controls = Settings.getControls(this.saveManager);
        const gyroMode = controls.mode === 'gyro';

        this._modeButton.setText(`Contrôle : ${gyroMode ? 'GYRO' : 'DOIGT'}`);
        this._invertButton.setText(`Inv. G/D : ${controls.gyro.invert ? 'OUI' : 'NON'}`);
        this._invertYButton.setText(`Inv. AV/AR : ${controls.gyro.invertY ? 'OUI' : 'NON'}`);
        this._tiltPad.setAlpha(gyroMode ? 1 : 0.4);
        this._sensitivityText.setText(controls.gyro.sensitivity.toFixed(2));
        this._musicText.setText(`${Math.round(Settings.getMusicVolume(this.saveManager) * 100)}%`);
        this._sfxText.setText(`${Math.round(Settings.getSfxVolume(this.saveManager) * 100)}%`);
        this._soundButton.setIcon(Settings.isSoundEnabled(this.saveManager) ? 'soundOn' : 'soundOff');
        this._gyroPreview = gyroMode ? new GyroInput(controls.gyro) : null;
    }
}
