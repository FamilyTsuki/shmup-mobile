import {AUTO, Game, Scale, Types} from 'phaser';
import GameOverScene from "./scenes/GameOverScene.ts";
import HomeScene from "./scenes/HomeScene.ts";
import MainGameScene from './scenes/MainGameScene.ts';
import MainUIScene from "./scenes/MainUIScene.ts";
import PauseScene from "./scenes/PauseScene.ts";
import OptionsScene from "./scenes/OptionsScene.ts";
import LevelSelectScene from "./scenes/LevelSelectScene.ts";
import ShopScene from "./scenes/ShopScene.ts";
import EntityManager from "./managers/EntityManager.ts";
import SaveManager from "./managers/SaveManager.ts";

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Types.Core.GameConfig = {
    type: AUTO,
    width: 1080,
    height: 1920,
    parent: 'game-container',
    backgroundColor: '#000',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
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
        ShopScene
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    const game = new Game(config);

    // Lets the browser console inspect and drive the game while developing
    if (import.meta.env.DEV)
        (window as unknown as { game: Game }).game = game;
});

// Installable and playable offline. Skipped in dev so the service worker never serves stale modules.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((error) => console.error('Service worker registration failed', error));
    });
}