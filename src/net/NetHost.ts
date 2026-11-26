import {GameObjects, Scene} from "phaser";
import Net from "./Net.ts";
import NetworkInput from "./NetworkInput.ts";
import Timeline from "./Timeline.ts";
import type {FxEvent, GuestMessage, HudState, SnapPlayer, Snapshot, SyncObject} from "./Protocol.ts";
import type Player from "../entities/Player.ts";
import RegistryConstants from "../RegistryConstants.ts";
import Health from "../components/Health.ts";
import type {Polarity} from "../gameData/PolarityData.ts";

/**
 * Host side of a coop game: reads the guests' inputs, and sends them what to draw.
 *
 * Snapshots are generic: every visible image or sprite of the game scene is sent with its texture, position,
 * rotation, scale, alpha and tint. Guests draw them without knowing what they are.
 * Effects and sounds are replayed on the guests by recording the calls made on the host.
 */
export default class NetHost {
    /** Snapshots per second */
    private static readonly SEND_RATE: number = 20;

    private readonly _scene: Scene;
    private readonly _inputs: Map<number, NetworkInput> = new Map();
    private readonly _ids: WeakMap<GameObjects.GameObject, number> = new WeakMap();
    private readonly _textureIndex: Map<string, number> = new Map();
    private _nextId: number = 1;
    private _fx: FxEvent[] = [];
    private _sinceSend: number = 0;
    private _players: Player[] = [];
    /** Called when a guest asks for a bomb */
    public onBomb: () => void = () => {};

    constructor(scene: Scene) {
        this._scene = scene;
        Net.on(Net.MESSAGE_EVENT, this.onMessage, this);
        Net.on(Net.PLAYERS_EVENT, this.onPlayersChanged, this);
    }

    /** One input per guest in the room, in room order */
    public createInputs(): { peerId: number, input: NetworkInput }[] {
        return Net.players.filter(id => id !== Net.myId).map(peerId => {
            const input = new NetworkInput();
            this._inputs.set(peerId, input);
            return {peerId, input};
        });
    }

    public setPlayers(players: Player[]) {
        this._players = players;
    }

    /**
     * Replays every call of these methods on the guests too.
     * @param target name the guests use to find the same object
     */
    public record<T extends object>(target: string, object: T, methods: (keyof T)[]) {
        for (const method of methods) {
            const original = (object[method] as unknown as (...args: unknown[]) => unknown).bind(object);
            (object as Record<keyof T, unknown>)[method] = (...args: unknown[]) => {
                this._fx.push([target, String(method), args]);
                return original(...args);
            };
        }
    }

    /** Sends an effect without playing it here, optionally to one guest only */
    public fx(target: string, method: string, args: unknown[], peerId?: number) {
        this._fx.push(peerId === undefined ? [target, method, args] : [target, method, args, peerId]);
    }

    public update(deltaTime: number) {
        this._sinceSend += deltaTime;
        const interval = 1000 / NetHost.SEND_RATE;
        if (!Timeline.due(this._sinceSend, interval))
            return;
        this._sinceSend = Math.max(0, this._sinceSend - interval);

        if (this._fx.length > 0) {
            Net.sendToGuests({k: 'fx', e: this._fx});
            this._fx = [];
        }
        Net.sendToGuests({k: 'snap', s: this.snapshot()});
    }

    public destroy() {
        Net.off(Net.MESSAGE_EVENT, this.onMessage, this);
        Net.off(Net.PLAYERS_EVENT, this.onPlayersChanged, this);
        this._inputs.forEach(input => input.destroy());
    }

    private idOf(object: GameObjects.GameObject): number {
        let id = this._ids.get(object);
        if (id === undefined) {
            id = this._nextId++;
            this._ids.set(object, id);
        }
        return id;
    }

    private snapshot(): Snapshot {
        const keys: [number, string][] = [];
        const objects: SyncObject[] = [];

        for (const child of this._scene.children.list) {
            // Backdrop tiles, texts and particles are drawn by the guests themselves
            if (!(child instanceof GameObjects.Image || child instanceof GameObjects.Sprite) || !child.visible || !child.active)
                continue;

            const key = child.texture.key;
            let textureIndex = this._textureIndex.get(key);
            if (textureIndex === undefined) {
                textureIndex = this._textureIndex.size;
                this._textureIndex.set(key, textureIndex);
                keys.push([textureIndex, key]);
            }

            objects.push([
                this.idOf(child), textureIndex, Math.round(child.x), Math.round(child.y),
                Math.round(child.rotation * 100), Math.round(child.scaleX * 100), Math.round(child.scaleY * 100),
                Math.round(child.alpha * 100), child.tintTopLeft, child.tintFill ? 1 : 0, child.depth,
            ]);
        }

        const registry = this._scene.registry;
        const hud: HudState = {
            score: Number(registry.get(RegistryConstants.Keys.PLAYER_SCORE) ?? 0),
            combo: Number(registry.get(RegistryConstants.Keys.COMBO) ?? 1),
            credits: Number(registry.get(RegistryConstants.Keys.RUN_CREDITS) ?? 0),
            bombs: Number(registry.get(RegistryConstants.Keys.BOMBS) ?? 0),
            bossHealth: Number(registry.get(RegistryConstants.Keys.BOSS_HEALTH) ?? -1),
            bossName: String(registry.get(RegistryConstants.Keys.BOSS_NAME) ?? ''),
            bossPolarity: (registry.get(RegistryConstants.Keys.BOSS_POLARITY) ?? 'ion') as Polarity,
            kills: Number(registry.get(RegistryConstants.Keys.KILLS) ?? 0),
        };

        const players: SnapPlayer[] = this._players.map(player => ({
            id: player.peerId === 0 ? Net.myId : player.peerId,
            index: player.index,
            objects: [player, ...player.followers].map(object => this.idOf(object)),
            lives: player.lives,
            resonance: player.charge,
            polarity: player.polarity,
            alive: player.active && !player.isGhost,
            ghost: player.active && player.isGhost,
        }));

        return {t: Math.round(this._scene.time.now), keys: keys.length > 0 ? keys : undefined, objects, players, hud};
    }

    private onMessage(from: number, data: GuestMessage) {
        switch (data.k) {
            case 'input':
                this._inputs.get(from)?.receive(data.s);
                break;
            case 'bomb':
                this.onBomb();
                break;
        }
    }

    /** A guest who leaves loses its ship */
    private onPlayersChanged(ids: number[]) {
        for (const player of this._players) {
            if (player.peerId !== 0 && !ids.includes(player.peerId) && player.active)
            {
                player.getComponent(Health)?.damage(player.lives);
                // Nobody controls it any more: not even a ghost
                player.disableBody(true, true);
            }
        }
    }
}
