import {GameObjects, Scene} from "phaser";
import GameConstants from "../GameConstants.ts";
import GyroInput from "../input/GyroInput.ts";
import GyroSensor from "../input/GyroSensor.ts";
import SaveManager from "../managers/SaveManager.ts";
import Settings from "../managers/Settings.ts";
import Button, {ButtonStyle} from "../ui/Button.ts";

export default class OptionsScene extends Scene {
    private static readonly SMALL_BUTTON: ButtonStyle = {width: 150, height: 150, fontSize: 72, fillColor: 0x3a2d5c};
    private static readonly TILT_BAR_WIDTH: number = 800;

    private saveManager: SaveManager;
    private _modeButton: Button;
    private _invertButton: Button;
    private _soundButton: Button;
    private _sensitivityText: GameObjects.Text;
    private _messageText: GameObjects.Text;
    private _tiltCursor: GameObjects.Rectangle;
    private _gyroPreview: GyroInput | null;

    constructor() {
        super(GameConstants.SceneKeys.OPTIONS);
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        const centerX = this.scale.width / 2;

        this._soundButton = new Button(this, centerX, 380, '', () => {
            Settings.setSoundEnabled(this.saveManager, !Settings.isSoundEnabled(this.saveManager));
            this.sound.mute = !Settings.isSoundEnabled(this.saveManager);
            this.refresh();
        });

        this.add.text(centerX, 200, 'OPTIONS', {fontSize: '110px', color: '#fff', fontFamily: 'future'}).setOrigin(0.5);

        this._modeButton = new Button(this, centerX, 560, '', () => this.toggleMode());

        this.add.text(centerX, 720, 'Sensibilité gyroscope', {fontSize: '44px', color: '#fff'}).setOrigin(0.5);
        new Button(this, centerX - 300, 840, '-', () => this.changeSensitivity(-Settings.GYRO_SENSITIVITY_STEP),
            OptionsScene.SMALL_BUTTON);
        this._sensitivityText = this.add.text(centerX, 840, '',
            {fontSize: '64px', color: '#ffe066', fontFamily: 'future'}).setOrigin(0.5);
        new Button(this, centerX + 300, 840, '+', () => this.changeSensitivity(Settings.GYRO_SENSITIVITY_STEP),
            OptionsScene.SMALL_BUTTON);

        this._invertButton = new Button(this, centerX, 1040, '', () => this.toggleInvert());
        new Button(this, centerX, 1240, 'RECALIBRER', () => {
            GyroSensor.calibrate();
            this._messageText.setText('Position actuelle = tout droit');
        });

        // Live preview of the gyroscope axis, to feel the sensitivity before playing
        this.add.rectangle(centerX, 1420, OptionsScene.TILT_BAR_WIDTH, 24, 0x555555);
        this.add.rectangle(centerX, 1420, 6, 60, 0xffffff, 0.5);
        this._tiltCursor = this.add.rectangle(centerX, 1420, 40, 60, 0xffe066);

        this._messageText = this.add.text(centerX, 1520, '', {fontSize: '40px', color: '#bbb', align: 'center'})
            .setOrigin(0.5);

        new Button(this, centerX, 1720, 'RETOUR', () => this.scene.start(GameConstants.SceneKeys.HOME));

        this.refresh();
    }

    update() {
        const axis = this._gyroPreview?.poll().moveX ?? 0;
        this._tiltCursor.x = this.scale.width / 2 + axis * OptionsScene.TILT_BAR_WIDTH / 2;
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

    private toggleInvert() {
        Settings.setGyroInvert(this.saveManager, !Settings.getControls(this.saveManager).gyro.invert);
        this.refresh();
    }

    private refresh() {
        const controls = Settings.getControls(this.saveManager);
        const gyroMode = controls.mode === 'gyro';

        this._modeButton.setText(`Contrôle : ${gyroMode ? 'GYRO' : 'DOIGT'}`);
        this._invertButton.setText(`Inverser : ${controls.gyro.invert ? 'OUI' : 'NON'}`);
        this._sensitivityText.setText(controls.gyro.sensitivity.toFixed(2));
        this._soundButton.setText(`Son : ${Settings.isSoundEnabled(this.saveManager) ? 'OUI' : 'NON'}`);
        this._gyroPreview = gyroMode ? new GyroInput(controls.gyro) : null;
    }
}
