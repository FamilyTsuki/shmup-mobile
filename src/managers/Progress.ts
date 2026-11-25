import SaveManager from "./SaveManager.ts";
import SaveConstants from "../SaveConstants.ts";
import type {UpgradeLevels} from "../gameData/UpgradeData.ts";

/**
 * Typed access to the meta progression stored by the SaveManager: credits, upgrades, levels and ships.
 */
export default class Progress {
    private static readonly DEFAULT_SHIP: number = 1;

    public static getCredits(saveManager: SaveManager): number {
        return Number(saveManager.getData(SaveConstants.Keys.CREDITS) ?? 0);
    }

    public static addCredits(saveManager: SaveManager, amount: number) {
        saveManager.setData(SaveConstants.Keys.CREDITS, Progress.getCredits(saveManager) + amount);
    }

    /** @returns false when the bank does not hold enough credits */
    public static spendCredits(saveManager: SaveManager, amount: number): boolean {
        const credits = Progress.getCredits(saveManager);
        if (credits < amount)
            return false;

        saveManager.setData(SaveConstants.Keys.CREDITS, credits - amount);
        return true;
    }

    public static getUpgradeLevels(saveManager: SaveManager): UpgradeLevels {
        return {...(saveManager.getData(SaveConstants.Keys.UPGRADE_LEVELS) ?? {})};
    }

    public static setUpgradeLevel(saveManager: SaveManager, upgradeKey: string, level: number) {
        const levels = Progress.getUpgradeLevels(saveManager);
        levels[upgradeKey] = level;
        saveManager.setData(SaveConstants.Keys.UPGRADE_LEVELS, levels);
    }

    public static getUnlockedLevel(saveManager: SaveManager): number {
        return Number(saveManager.getData(SaveConstants.Keys.UNLOCKED_LEVEL) ?? 0);
    }

    public static unlockLevel(saveManager: SaveManager, levelIndex: number) {
        if (levelIndex > Progress.getUnlockedLevel(saveManager))
            saveManager.setData(SaveConstants.Keys.UNLOCKED_LEVEL, levelIndex);
    }

    public static getSelectedShip(saveManager: SaveManager): number {
        return Number(saveManager.getData(SaveConstants.Keys.SELECTED_SHIP) ?? Progress.DEFAULT_SHIP);
    }

    public static selectShip(saveManager: SaveManager, shipId: number) {
        saveManager.setData(SaveConstants.Keys.SELECTED_SHIP, shipId);
    }

    public static getUnlockedShips(saveManager: SaveManager): number[] {
        return [...(saveManager.getData(SaveConstants.Keys.UNLOCKED_SHIPS) ?? [Progress.DEFAULT_SHIP])];
    }

    public static unlockShip(saveManager: SaveManager, shipId: number) {
        const ships = Progress.getUnlockedShips(saveManager);
        if (!ships.includes(shipId))
            saveManager.setData(SaveConstants.Keys.UNLOCKED_SHIPS, [...ships, shipId]);
    }
}
