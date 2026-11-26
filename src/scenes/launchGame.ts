import {Scene} from "phaser";
import GameConstants from "../GameConstants.ts";
import GyroSensor from "../input/GyroSensor.ts";
import SaveManager from "../managers/SaveManager.ts";
import Settings from "../managers/Settings.ts";
import type {MainGameSceneData} from "./MainGameScene.ts";
import Net from "../net/Net.ts";

/**
 * Starts a level, or a stage of the endless mode, from a tap: asks for fullscreen and the gyroscope permission,
 * which browsers only grant during a user gesture, then starts the game and its HUD.
 * @param target index in levels.json, or the scene data of an endless stage
 */
export default function launchGame(scene: Scene, saveManager: SaveManager, target: number | MainGameSceneData) {
    if (scene.sys.game.device.input.touch && scene.scale.fullscreen.available && !scene.scale.isFullscreen)
        scene.scale.startFullscreen();

    const data: MainGameSceneData = typeof target === 'number' ? {level: target} : target;
    const start = () => {
        // Coop host: the guests start their side at the same time. The endless mode is solo only.
        if (Net.role === 'host' && data.level !== undefined)
            Net.sendToGuests({k: 'start', level: data.level});
        scene.scene.launch(GameConstants.SceneKeys.MAIN_UI);
        scene.scene.start(GameConstants.SceneKeys.MAIN_GAME, data);
    };

    if (Settings.getControls(saveManager).mode !== 'gyro') {
        start();
        return;
    }

    // Without the sensor the ship could not move: a refusal switches to touch for this visit (see Settings)
    GyroSensor.requestAccess().then(() => start());
}
