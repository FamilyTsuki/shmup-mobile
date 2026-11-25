export type BulletData = {
    width: number;
    height: number;
    color: number;
    speed: number;
    damage: number;
}

/** Same as BulletData with a readable "#rrggbb" color, as written in the JSON files */
export type BulletJsonData = Omit<BulletData, 'color'> & {
    color: string;
}

export function toBulletData(json: BulletJsonData): BulletData {
    return {...json, color: Phaser.Display.Color.HexStringToColor(json.color).color};
}
