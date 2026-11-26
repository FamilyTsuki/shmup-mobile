import {Scene} from "phaser";
import GameConstants from "../GameConstants.ts";
import GyroSensor from "../input/GyroSensor.ts";
import SaveManager from "../managers/SaveManager.ts";
import Settings from "../managers/Settings.ts";
import type {MainGameSceneData} from "./MainGameScene.ts";
import Net from "../net/Net.ts";

/**
 * Starts a level from a tap: asks for fullscreen and the gyroscope permission, which browsers only grant
 * during a user gesture, then starts the game and its HUD.
 */
export default function launchGame(scene: Scene, saveManager: SaveManager, level: number) {
    if (scene.sys.game.device.input.touch && scene.scale.fullscreen.available && !scene.scale.isFullscreen)
        scene.scale.startFullscreen();

    const start = () => {
        // Coop host: the guests start their side at the same time
        if (Net.role === 'host')
            Net.sendToGuests({k: 'start', level});
        const data: MainGameSceneData = {level};
        scene.scene.launch(GameConstants.SceneKeys.MAIN_UI);
        scene.scene.start(GameConstants.SceneKeys.MAIN_GAME, data);
    };

    if (Settings.getControls(saveManager).mode !== 'gyro') {
        start();
        return;
    }

    GyroSensor.requestAccess().then((granted) => {
        // Without the sensor the ship could not move: fall back to touch for this device
        if (!granted)
            Settings.setControlMode(saveManager, 'touch');
        start();
    });
}
