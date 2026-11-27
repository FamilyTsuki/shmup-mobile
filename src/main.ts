import {AUTO, Core, Game, Scale, Scenes, Types} from 'phaser';
import GameOverScene from "./scenes/GameOverScene.ts";
import HomeScene from "./scenes/HomeScene.ts";
import MainGameScene from './scenes/MainGameScene.ts';
import MainUIScene from "./scenes/MainUIScene.ts";
import PauseScene from "./scenes/PauseScene.ts";
import OptionsScene from "./scenes/OptionsScene.ts";
import LevelSelectScene from "./scenes/LevelSelectScene.ts";
import ShopScene from "./scenes/ShopScene.ts";
import LobbyScene from "./scenes/LobbyScene.ts";
import RemoteGameScene from "./scenes/RemoteGameScene.ts";
import NameScene from "./scenes/NameScene.ts";
import BoardScene from "./scenes/BoardScene.ts";
import CoopFlow from "./net/CoopFlow.ts";
import EntityManager from "./managers/EntityManager.ts";
import SaveManager from "./managers/SaveManager.ts";
import GameConstants from "./GameConstants.ts";
import Music from "./audio/Music.ts";
import StartOverlay from "./ui/StartOverlay.ts";

const MENU_FADE_MS: number = 220;

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Types.Core.GameConfig = {
    type: AUTO,
    width: 1080,
    height: 1920,
    parent: 'game-container',
    backgroundColor: '#0f0c1d',
    // Pixel art: nearest neighbor scaling, no blur
    pixelArt: true,
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    // One finger steers, a second finger switches polarity
    input: {
        activePointers: 3,
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
        }
    },
    plugins: {
        global: [
            {key: SaveManager.PLUGIN_KEY, plugin: SaveManager, mapping: SaveManager.MAPPING_NAME}
        ],
        scene: [
            {key: EntityManager.PLUGIN_KEY, plugin: EntityManager, mapping: EntityManager.MAPPING_NAME}
        ]
    },
    // fps: { forceSetTimeOut: true, target: 120 },
    scene: [
        HomeScene,
        MainGameScene,
        MainUIScene,
        GameOverScene,
        PauseScene,
        OptionsScene,
        LevelSelectScene,
        ShopScene,
        LobbyScene,
        RemoteGameScene,
        NameScene,
        BoardScene
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    const game = new Game(config);
    CoopFlow.install(game);
    StartOverlay.show(game);

    // Menu screens fade in and bring back the menu theme (a no-op when it already plays)
    const menuScenes: string[] = [GameConstants.SceneKeys.HOME, GameConstants.SceneKeys.LOBBY,
        GameConstants.SceneKeys.LEVEL_SELECT, GameConstants.SceneKeys.SHOP, GameConstants.SceneKeys.BOARD,
        GameConstants.SceneKeys.NAME];
    game.events.once(Core.Events.READY, () => {
        for (const key of menuScenes) {
            const scene = game.scene.getScene(key);
            scene.sys.events.on(Scenes.Events.CREATE, () => {
                scene.cameras.main.fadeIn(MENU_FADE_MS, 15, 12, 29);
                Music.play(scene.sound, 'menu');
            });
        }
    });

    // Lets the browser console inspect and drive the game while developing
    if (import.meta.env.DEV)
        (window as unknown as { game: Game }).game = game;
});

// Installable and playable offline. Skipped in dev so the service worker never serves stale modules,
// and on itch.io (VITE_SERVER_URL set) where the game runs in an iframe of their domain.
if (import.meta.env.PROD && !import.meta.env.VITE_SERVER_URL && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((error) => console.error('Service worker registration failed', error));
    });
}