import type {PickupType} from "../gameData/PowerUpData.ts";
import TextureFactory from "../utils/TextureFactory.ts";
import Entity from "./Entity.ts";

/**
 * Credit or power-up falling from a dead enemy. Flies to the player once inside its magnet radius.
 */
export default class Pickup extends Entity {
    private static readonly FALL_SPEED: number = 0.12;
    private static readonly MAGNET_SPEED: number = 1.1;
    private static readonly SCATTER_SPEED: number = 0.25;
    private static readonly SCATTER_DRAG: number = 0.004;
    private static readonly BODY_RADIUS: number = 34;

    private _pickupType: PickupType;
    private _value: number = 0;
    private _magnetTarget: Entity | null = null;
    private _magnetRadius: number = 0;
    private _driftX: number = 0;
    private _driftY: number = 0;

    public get pickupType(): PickupType {
        return this._pickupType;
    }

    /** Credits for a coin, unused by power-ups */
    public get value(): number {
        return this._value;
    }

    public init() {
        this.arcadeBody.setCircle(Pickup.BODY_RADIUS);
    }

    public enable(type: PickupType, x: number, y: number, value: number, magnetTarget: Entity, magnetRadius: number) {
        this._pickupType = type;
        this._value = value;
        this._magnetTarget = magnetTarget;
        this._magnetRadius = magnetRadius;

        this.setTexture(TextureFactory.pickupKey(type));
        this.arcadeBody.setCircle(Pickup.BODY_RADIUS, this.width / 2 - Pickup.BODY_RADIUS, this.height / 2 - Pickup.BODY_RADIUS);
        this.enableBody(true, x, y, true, true);

        // Burst outward a little so several drops do not stack on the same spot
        const angle = Math.random() * Math.PI * 2;
        this._driftX = Math.cos(angle) * Pickup.SCATTER_SPEED;
        this._driftY = Math.sin(angle) * Pickup.SCATTER_SPEED;

        this.setScale(type === 'credit' ? 0.6 : 1);
    }

    public attractTo(target: Entity) {
        this._magnetTarget = target;
        this._magnetRadius = Number.POSITIVE_INFINITY;
    }

    public disable() {
        this.disableBody(true, true);
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime);

        const target = this._magnetTarget;
        if (target?.active && Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y) < this._magnetRadius) {
            const direction = new Phaser.Math.Vector2(target.x - this.x, target.y - this.y).normalize();
            this.x += direction.x * Pickup.MAGNET_SPEED * deltaTime;
            this.y += direction.y * Pickup.MAGNET_SPEED * deltaTime;
            return;
        }

        const drag = Math.max(0, 1 - Pickup.SCATTER_DRAG * deltaTime);
        this._driftX *= drag;
        this._driftY *= drag;
        this.x += this._driftX * deltaTime;
        this.y += (this._driftY + Pickup.FALL_SPEED) * deltaTime;

        if (this.y > this.scene.cameras.main.height + this.displayHeight)
            this.disable();
    }
}
