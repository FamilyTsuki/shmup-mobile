export default class GameConstants {
    public static readonly Events = Object.freeze({
        PLAYER_SPAWNED_EVENT: "playerSpawned",
        ENEMY_SPAWNED_EVENT: "enemySpawned",
        PAUSE_REQUESTED_EVENT: "pauseRequested",
    } as const);

    public static readonly SceneKeys = Object.freeze({
        HOME: "HomeScene",
        MAIN_GAME: "MainGameScene",
        MAIN_UI: "MainUIScene",
        GAME_OVER: "GameOverScene",
        PAUSE: "PauseScene",
        OPTIONS: "OptionsScene",
    } as const);

    public static readonly DataKeys = Object.freeze({
        SINUSOIDAL_ENEMY: "sinusoidalEnemy",
    } as const);

    public static readonly MAX_SCORE_DIGITS: number = 6;
}