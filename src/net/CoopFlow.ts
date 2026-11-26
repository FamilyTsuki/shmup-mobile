import type {Game} from "phaser";
import Net from "./Net.ts";
import type {HostMessage} from "./Protocol.ts";
import GameConstants from "../GameConstants.ts";

/**
 * Moves a coop guest between scenes when the host decides: the game starts, stops, or the room closes.
 * Installed once for the page, whatever scene is showing.
 */
export default class CoopFlow {
    /** Set when the room closed under the player's feet, for the next screen to explain why */
    public static closedMessage: string = '';

    private static readonly GAME_SCENES: string[] = [
        GameConstants.SceneKeys.MAIN_GAME, GameConstants.SceneKeys.REMOTE_GAME, GameConstants.SceneKeys.MAIN_UI,
        GameConstants.SceneKeys.PAUSE, GameConstants.SceneKeys.GAME_OVER, GameConstants.SceneKeys.LOBBY,
        GameConstants.SceneKeys.HOME, GameConstants.SceneKeys.SHOP, GameConstants.SceneKeys.OPTIONS,
        GameConstants.SceneKeys.LEVEL_SELECT,
    ];

    public static install(game: Game) {
        Net.on(Net.MESSAGE_EVENT, (_from: number, data: HostMessage) => {
            if (Net.role !== 'guest')
                return;
            if (data.k === 'start') {
                CoopFlow.stopAll(game);
                game.scene.start(GameConstants.SceneKeys.MAIN_UI);
                game.scene.start(GameConstants.SceneKeys.REMOTE_GAME, {level: data.level});
            } else if (data.k === 'abort') {
                CoopFlow.stopAll(game);
                game.scene.start(GameConstants.SceneKeys.LOBBY, {});
            }
        });

        Net.on(Net.CLOSED_EVENT, () => {
            CoopFlow.closedMessage = 'Le salon a été fermé';
            CoopFlow.stopAll(game);
            game.scene.start(GameConstants.SceneKeys.LOBBY, {});
        });
    }

    private static stopAll(game: Game) {
        for (const key of CoopFlow.GAME_SCENES) {
            if (game.scene.isActive(key) || game.scene.isPaused(key))
                game.scene.stop(key);
        }
    }
}
