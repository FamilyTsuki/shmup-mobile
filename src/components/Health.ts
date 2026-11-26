import IComponent from "./IComponent.ts";
import Entity from "../entities/Entity.ts";

export default class Health extends Phaser.Events.EventEmitter implements IComponent {
    public enabled: boolean = true;

    public static readonly CHANGE_EVENT: string = 'change';
    public static readonly DEATH_EVENT: string = 'death';

    private _current: number;
    private _max: number;

    public get current(): number {
        return this._current;
    }

    public get max(): number {
        return this._max;
    }

    /**
     * @param _owner entity that has this component, kept in the signature for the component pattern
     */
    public constructor(value: number, _owner: Entity) {
        super();

        this._current = value;
        this._max = value;
    }

    /**
     * Refills to a new maximum without emitting events, for pooled entities and difficulty scaling.
     */
    public reset(max: number = this._max): void {
        this._max = max;
        this._current = max;
    }

    public damage(amount: number, emitEvents: boolean = true): void {
        if (!this.enabled || amount <= 0) return;
        this.adjust(-amount, emitEvents);
    }

    public heal(amount: number, emitEvents: boolean = true): void {
        if (!this.enabled || amount <= 0) return;
        this.adjust(amount, emitEvents);
    }

    private adjust(delta: number, emitEvents: boolean = true): void {
        if (!this.enabled)
            return;

        const prev: number = this._current;
        this._current = Phaser.Math.Clamp(this._current + delta, 0, this._max);

        if (emitEvents && this._current !== prev) {
            this.emit(Health.CHANGE_EVENT, this._current);

            // Explosions are drawn by whoever listens to the death, see Effects
            if (this._current <= 0 && prev > 0)
                this.emit(Health.DEATH_EVENT);
        }
    }
}