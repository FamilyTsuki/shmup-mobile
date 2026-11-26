import {Physics} from 'phaser';
import {BulletData} from "../gameData/BulletData.ts";
import Bullet from "../entities/Bullet.ts";
import Entity from "../entities/Entity.ts";
import IComponent from "./IComponent.ts";

export type WeaponSpawnPoint = {
    x: number;
    y: number;
    rotation?: number;
};

export default class Weapon implements IComponent {
    public enabled: boolean = true;

    private readonly _bullets: Physics.Arcade.Group;
    private readonly _bulletData: BulletData;

    constructor(bullets: Physics.Arcade.Group, bulletData: BulletData) {
        if (!bullets) {
            console.error("Weapon 'bullets' group cannot be null or undefined");
        }

        this._bullets = bullets;
        this._bulletData = bulletData;
    }

    /** @returns the bullets fired, so the caller can give them a behavior (homing...) */
    public shoot(source: Entity, angleOffset: number = 0, spawnPoint?: WeaponSpawnPoint): Bullet[] {
        if (!this.enabled)
            return [];

        const bullet = this.spawnBullet(source, angleOffset, spawnPoint);
        return bullet ? [bullet] : [];
    }

    protected spawnBullet(source: Entity, angleOffset: number, spawnPoint?: WeaponSpawnPoint): Bullet | null {
        if (!this._bullets)
            return null;

        const bullet: Bullet = this._bullets.get() as Bullet;
        if (bullet) {
            const baseRotation = spawnPoint?.rotation ?? source.rotation;
            const sourceForward: Phaser.Math.Vector2 = new Phaser.Math.Vector2(1, 0).rotate(baseRotation + angleOffset);
            const bulletVelocity: Phaser.Math.Vector2 = sourceForward.clone().scale(this._bulletData.speed);
            const spawnX = spawnPoint ? spawnPoint.x : source.x + sourceForward.x * source.arcadeBody.radius;
            const spawnY = spawnPoint ? spawnPoint.y : source.y + sourceForward.y * source.arcadeBody.radius;
            bullet.enable(spawnX, spawnY, bulletVelocity.x, bulletVelocity.y, this._bulletData);
        }
        return bullet ?? null;
    }
}