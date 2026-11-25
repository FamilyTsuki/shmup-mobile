import {Physics} from 'phaser';
import {BulletData} from "../gameData/BulletData.ts";
import Entity from "../entities/Entity.ts";
import Weapon from "./Weapon.ts";

const FULL_CIRCLE_DEG: number = 360;

export default class SpreadWeapon extends Weapon {
    private _bulletCount: number;
    private _spreadAngleDeg: number;

    constructor(bullets: Physics.Arcade.Group, bulletData: BulletData, bulletCount: number, spreadAngleDeg: number) {
        super(bullets, bulletData);

        this._bulletCount = bulletCount;
        this._spreadAngleDeg = spreadAngleDeg;
    }

    public setPattern(bulletCount: number, spreadAngleDeg: number) {
        this._bulletCount = bulletCount;
        this._spreadAngleDeg = spreadAngleDeg;
    }

    /**
     * @param angleOffset rotation in radians added to the source forward direction, to aim the whole fan
     */
    public override shoot(source: Entity, angleOffset: number = 0) {
        if (!this.enabled)
            return;

        if (this._bulletCount <= 1) {
            super.shoot(source, angleOffset);
            return;
        }

        const isFullCircle = this._spreadAngleDeg >= FULL_CIRCLE_DEG;
        const stepDeg = isFullCircle
            ? this._spreadAngleDeg / this._bulletCount
            : this._spreadAngleDeg / (this._bulletCount - 1);
        const startDeg = isFullCircle ? 0 : -this._spreadAngleDeg / 2;

        for (let i = 0; i < this._bulletCount; i++) {
            this.spawnBullet(source, angleOffset + Phaser.Math.DegToRad(startDeg + i * stepDeg));
        }
    }
}
