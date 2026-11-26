import SaveManager from "./SaveManager.ts";
import SaveConstants from "../SaveConstants.ts";

/**
 * Nickname shown on the leaderboard. Upper case letters, digits, space, - and _ only:
 * the pixel font draws nothing else, and the server checks the same rule.
 */
export default class PlayerName {
    public static readonly MAX_LENGTH: number = 12;

    public static get(saveManager: SaveManager): string {
        return String(saveManager.getData(SaveConstants.Keys.PLAYER_NAME) ?? '');
    }

    public static set(saveManager: SaveManager, name: string) {
        saveManager.setData(SaveConstants.Keys.PLAYER_NAME, PlayerName.clean(name).trim());
    }

    /** Accents dropped, upper case, unknown characters removed, cut to MAX_LENGTH */
    public static clean(name: string): string {
        return name.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()
            .replace(/[^A-Z0-9 _-]/g, '').replace(/\s+/g, ' ').trimStart().slice(0, PlayerName.MAX_LENGTH);
    }
}
