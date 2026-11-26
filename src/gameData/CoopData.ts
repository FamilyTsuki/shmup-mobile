/** Gameplay values of coop.json: what only happens with two players or more */
export type CoopData = {
    /** A dead player becomes a ghost that keeps flying */
    ghost: {
        alpha: number;
        /** "#rrggbb" */
        tint: string;
        /** Enemies this close to a ghost move slower */
        slowRadius: number;
        slowFactor: number;
        /** Tapping as a ghost scares the enemies around: they back off and stop shooting */
        booRadius: number;
        booCooldownMs: number;
        scareMs: number;
        scarePushPx: number;
    };
    /** A ghost staying close to a living ally comes back to life */
    revive: { distance: number, holdMs: number, lives: number, invulnerableMs: number };
    /** Two ships touching share a boost of resonance */
    highFive: { distance: number, cooldownMs: number, resonanceBonus: number, score: number };
    /** Two bursts released almost together merge into a huge one */
    syncBurst: { windowMs: number, radius: number, strength: number, score: number };
};
