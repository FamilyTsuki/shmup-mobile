import SaveManager from "./SaveManager.ts";
import SaveConstants from "../SaveConstants.ts";
import type {UpgradeLevels} from "../gameData/UpgradeData.ts";
import Net from "../net/Net.ts";

/**
 * Typed access to the meta progression stored by the SaveManager: credits, upgrades, levels and ships.
 * Coop has its own progression: while in a coop room every value is read and written under coop keys.
 */
export default class Progress {
    private static readonly DEFAULT_SHIP: number = 1;
    private static readonly COOP_PREFIX: string = 'coop_';

    /** True while in a coop room: the coop progression is the one shown, spent and earned */
    public static get isCoop(): boolean {
        return Net.role !== null;
    }

    private static key(key: string): string {
        return Progress.isCoop ? Progress.COOP_PREFIX + key : key;
    }

    public static getCredits(saveManager: SaveManager): number {
        return Number(saveManager.getData(Progress.key(SaveConstants.Keys.CREDITS)) ?? 0);
    }

    public static addCredits(saveManager: SaveManager, amount: number) {
        saveManager.setData(Progress.key(SaveConstants.Keys.CREDITS), Progress.getCredits(saveManager) + amount);
    }

    /** @returns false when the bank does not hold enough credits */
    public static spendCredits(saveManager: SaveManager, amount: number): boolean {
        const credits = Progress.getCredits(saveManager);
        if (credits < amount)
            return false;

        saveManager.setData(Progress.key(SaveConstants.Keys.CREDITS), credits - amount);
        return true;
    }

    public static getUpgradeLevels(saveManager: SaveManager): UpgradeLevels {
        return {...(saveManager.getData(Progress.key(SaveConstants.Keys.UPGRADE_LEVELS)) ?? {})};
    }

    public static setUpgradeLevel(saveManager: SaveManager, upgradeKey: string, level: number) {
        const levels = Progress.getUpgradeLevels(saveManager);
        levels[upgradeKey] = level;
        saveManager.setData(Progress.key(SaveConstants.Keys.UPGRADE_LEVELS), levels);
    }

    public static getUnlockedLevel(saveManager: SaveManager): number {
        return Number(saveManager.getData(Progress.key(SaveConstants.Keys.UNLOCKED_LEVEL)) ?? 0);
    }

    public static unlockLevel(saveManager: SaveManager, levelIndex: number) {
        if (levelIndex > Progress.getUnlockedLevel(saveManager))
            saveManager.setData(Progress.key(SaveConstants.Keys.UNLOCKED_LEVEL), levelIndex);
    }

    public static getSelectedShip(saveManager: SaveManager): number {
        return Number(saveManager.getData(Progress.key(SaveConstants.Keys.SELECTED_SHIP)) ?? Progress.DEFAULT_SHIP);
    }

    public static selectShip(saveManager: SaveManager, shipId: number) {
        saveManager.setData(Progress.key(SaveConstants.Keys.SELECTED_SHIP), shipId);
    }

    public static getUnlockedShips(saveManager: SaveManager): number[] {
        return [...(saveManager.getData(Progress.key(SaveConstants.Keys.UNLOCKED_SHIPS)) ?? [Progress.DEFAULT_SHIP])];
    }

    public static unlockShip(saveManager: SaveManager, shipId: number) {
        const ships = Progress.getUnlockedShips(saveManager);
        if (!ships.includes(shipId))
            saveManager.setData(Progress.key(SaveConstants.Keys.UNLOCKED_SHIPS), [...ships, shipId]);
    }
}
