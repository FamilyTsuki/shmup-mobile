import {Physics} from 'phaser';
import {BulletData} from "../gameData/BulletData.ts";
import Entity from "../entities/Entity.ts";
import Weapon, {WeaponSpawnPoint} from "./Weapon.ts";
import type Bullet from "../entities/Bullet.ts";

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
    public override shoot(source: Entity, angleOffset: number = 0, spawnPoint?: WeaponSpawnPoint): Bullet[] {
        if (!this.enabled)
            return [];

        if (this._bulletCount <= 1)
            return super.shoot(source, angleOffset, spawnPoint);

        const isFullCircle = this._spreadAngleDeg >= FULL_CIRCLE_DEG;
        const stepDeg = isFullCircle
            ? this._spreadAngleDeg / this._bulletCount
            : this._spreadAngleDeg / (this._bulletCount - 1);
        const startDeg = isFullCircle ? 0 : -this._spreadAngleDeg / 2;

        const bullets: Bullet[] = [];
        for (let i = 0; i < this._bulletCount; i++) {
            const bullet = this.spawnBullet(source, angleOffset + Phaser.Math.DegToRad(startDeg + i * stepDeg), spawnPoint);
            if (bullet)
                bullets.push(bullet);
        }
        return bullets;
    }
}
