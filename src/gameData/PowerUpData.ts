export type PowerUpType = 'rapidFire' | 'multiShot' | 'shield' | 'heal' | 'bomb';

/** Everything that can fall from a dead enemy */
export type PickupType = PowerUpType | 'credit';

export type PowerUpsData = {
    /** Credits dropped by an enemy = its score * creditsPerScore, rounded up */
    creditsPerScore: number;
    /** Number of coins scattered by a dying boss */
    bossCreditCoins: number;
    /** Relative chance of each power-up when an enemy drops one */
    dropWeights: { [type in PowerUpType]: number };
    rapidFire: { durationMs: number, fireRateMultiplier: number };
    multiShot: { durationMs: number, extraBullets: number };
    shield: { hits: number };
    heal: { amount: number };
    bomb: { amount: number, enemyDamage: number, bossDamage: number };
};
