import type {Polarity} from "./PolarityData.ts";
import type {BulletShape} from "../utils/TextureFactory.ts";

export type BulletData = {
    /** Visual and hitbox size in px: diameter of an orb, length and thickness of a needle or bolt */
    width: number;
    height: number;
    speed: number;
    damage: number;
    polarity: Polarity;
    shape: BulletShape;
}

/** As written in the JSON files: the polarity comes from the shooter, the shape from the size */
export type BulletJsonData = Omit<BulletData, 'polarity' | 'shape'>;

/**
 * Round bullets (width == height) are orbs, longer ones are needles.
 */
export function toBulletData(json: BulletJsonData, polarity: Polarity): BulletData {
    return {...json, polarity, shape: json.width === json.height ? 'orb' : 'needle'};
}
