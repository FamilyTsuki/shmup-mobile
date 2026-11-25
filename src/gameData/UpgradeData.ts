/** Ship stats once every upgrade bought is applied */
export type PlayerStats = {
    fireDelayMs: number;
    damage: number;
    bulletCount: number;
    maxHealth: number;
    magnetRadius: number;
    bombs: number;
};

export type UpgradeData = {
    name: string;
    description: string;
    stat: keyof PlayerStats;
    /**
     * Added to the stat per level. For fireDelayMs it is a ratio: -0.12 makes the delay 12% shorter per level.
     */
    perLevel: number;
    maxLevel: number;
    baseCost: number;
    /** cost(level) = baseCost * costGrowth ^ level */
    costGrowth: number;
};

export type UpgradesData = {
    base: PlayerStats;
    upgrades: { [upgradeKey: string]: UpgradeData };
};

/** Bought level of each upgrade key, as saved */
export type UpgradeLevels = { [upgradeKey: string]: number };

export function upgradeCost(upgrade: UpgradeData, level: number): number {
    return Math.round(upgrade.baseCost * Math.pow(upgrade.costGrowth, level));
}

export function computePlayerStats(data: UpgradesData, levels: UpgradeLevels): PlayerStats {
    const stats: PlayerStats = {...data.base};

    for (const [key, upgrade] of Object.entries(data.upgrades)) {
        const level = Math.min(levels[key] ?? 0, upgrade.maxLevel);
        if (upgrade.stat === 'fireDelayMs')
            stats.fireDelayMs *= Math.pow(1 + upgrade.perLevel, level);
        else
            stats[upgrade.stat] += upgrade.perLevel * level;
    }

    return stats;
}
