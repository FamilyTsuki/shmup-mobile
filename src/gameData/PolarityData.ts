/**
 * The core mechanic: every ship and every bullet is ION (cyan) or PLASMA (magenta).
 * - Bullets of the player's polarity are absorbed and charge the resonance gauge, the others hurt.
 * - Player shots deal more damage to enemies of the opposite polarity.
 * - Switching polarity with enough resonance releases a burst that turns nearby enemy bullets into player shots.
 */
export type Polarity = 'ion' | 'plasma';

/**
 * How a spawn group or a boss pattern picks the polarity of what it creates.
 * alternate: ion, plasma, ion... per enemy (or per shot for a boss pattern)
 */
export type PolarityRule = Polarity | 'alternate' | 'random';

export const POLARITIES: readonly Polarity[] = ['ion', 'plasma'];

/**
 * Colors of the things on screen: a polarity, or DANGER (orange) for what always hurts, whatever the player's
 * polarity: bullets that cannot be absorbed, enemies that ram the ship.
 */
export type ShipColor = Polarity | 'hazard';

export type PolarityStyle = {
    name: string;
    /** Main color */
    color: number;
    css: string;
    /** Near white tint of the color, for bright cores */
    lightCss: string;
};

export const POLARITY_STYLES: { readonly [polarity in Polarity]: PolarityStyle } = Object.freeze({
    // Same mid and light shades as the pixel art palette in TextureFactory
    ion: {name: 'ION', color: 0x46a9c6, css: '#46a9c6', lightCss: '#9be0ec'},
    plasma: {name: 'PLASMA', color: 0xd0577f, css: '#d0577f', lightCss: '#f3a9c1'},
});

/** Orange: far from the cyan and the pink of the polarities */
export const HAZARD_STYLE: PolarityStyle = Object.freeze({name: 'DANGER', color: 0xff9a2e, css: '#ff9a2e', lightCss: '#ffd08a'});

export function oppositePolarity(polarity: Polarity): Polarity {
    return polarity === 'ion' ? 'plasma' : 'ion';
}

/**
 * @param index position of the enemy in its group, or shot count of a boss pattern
 */
export function resolvePolarity(rule: PolarityRule | undefined, index: number): Polarity {
    switch (rule) {
        case 'ion':
        case 'plasma':
            return rule;
        case 'random':
            return Math.random() < 0.5 ? 'ion' : 'plasma';
        default:
            return index % 2 === 0 ? 'ion' : 'plasma';
    }
}

/** Gameplay values of polarity.json */
export type PolarityData = {
    /** Minimum time between two switches */
    switchCooldownMs: number;
    /** Resonance gained per absorbed bullet, the gauge holds 100 */
    absorbCharge: number;
    /** Points per absorbed bullet, multiplied by the combo */
    absorbScore: number;
    /** Damage multiplier of a player shot on an enemy of the opposite polarity */
    oppositeDamageMultiplier: number;
    /** A full gauge cannot absorb more: bullets of the player polarity hurt until a switch releases it */
    overloadAtFullCharge: boolean;
    burst: {
        /** Resonance needed for a switch to release a burst */
        minCharge: number;
        /** Burst radius in px at minCharge and at full gauge */
        minRadius: number;
        maxRadius: number;
        /** Damage to enemies inside the radius at full gauge, scaled down with the charge */
        enemyDamage: number;
        bossDamage: number;
        /** Enemy bullets turned into player shots */
        convertedBullet: { width: number, height: number, speed: number, damage: number };
    };
};
