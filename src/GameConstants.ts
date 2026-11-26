export default class GameConstants {
    public static readonly Events = Object.freeze({
        PLAYER_SPAWNED_EVENT: "playerSpawned",
        ENEMY_SPAWNED_EVENT: "enemySpawned",
        PAUSE_REQUESTED_EVENT: "pauseRequested",
        /** (text: string) big centered message on the HUD */
        BANNER_EVENT: "banner",
        BOMB_REQUESTED_EVENT: "bombRequested",
        POLARITY_REQUESTED_EVENT: "polarityRequested",
        /** (speaker: string, lines: string[], lineMs: number) dialogue box on the HUD */
        DIALOGUE_EVENT: "dialogue",
        /** (text: string) smaller tutorial message under the banner */
        HINT_EVENT: "hint",
        /** The options screen closed: the running game re-reads the control settings */
        CONTROLS_CHANGED_EVENT: "controlsChanged",
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
        LOBBY: "LobbyScene",
        REMOTE_GAME: "RemoteGameScene",
        NAME: "NameScene",
        BOARD: "BoardScene",
    } as const);

    public static readonly DataKeys = Object.freeze({
        ENEMIES: "enemies",
        LEVELS: "levels",
        BOSSES: "bosses",
        POWER_UPS: "powerUps",
        UPGRADES: "upgrades",
        PLAYER_SHIPS: "playerShips",
        POLARITY: "polarity",
        COOP: "coop",
        ENDLESS: "endless",
    } as const);

    public static readonly MAX_SCORE_DIGITS: number = 6;
    /** Ship line, from the bottom of the screen: above the control strip of the HUD */
    public static readonly PLAYER_Y_FROM_BOTTOM: number = 400;
    /** Height of the bottom strip holding the polarity gauge and the bomb button */
    public static readonly HUD_STRIP_HEIGHT: number = 250;
}