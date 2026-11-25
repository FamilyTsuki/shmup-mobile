export default class GameConstants {
    public static readonly Events = Object.freeze({
        PLAYER_SPAWNED_EVENT: "playerSpawned",
        ENEMY_SPAWNED_EVENT: "enemySpawned",
        PAUSE_REQUESTED_EVENT: "pauseRequested",
        /** (text: string) big centered message on the HUD */
        BANNER_EVENT: "banner",
        BOMB_REQUESTED_EVENT: "bombRequested",
    } as const);

    public static readonly SceneKeys = Object.freeze({
        HOME: "HomeScene",
        MAIN_GAME: "MainGameScene",
        MAIN_UI: "MainUIScene",
        GAME_OVER: "GameOverScene",
        PAUSE: "PauseScene",
        OPTIONS: "OptionsScene",
        LEVEL_SELECT: "LevelSelectScene",
        SHOP: "ShopScene",
    } as const);

    public static readonly DataKeys = Object.freeze({
        ENEMIES: "enemies",
        LEVELS: "levels",
        BOSSES: "bosses",
        POWER_UPS: "powerUps",
        UPGRADES: "upgrades",
        PLAYER_SHIPS: "playerShips",
    } as const);

    public static readonly MAX_SCORE_DIGITS: number = 6;
}