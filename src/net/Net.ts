import type {GuestMessage, HostMessage, LobbyPlayer} from "./Protocol.ts";
import type {PlayerStats} from "../gameData/UpgradeData.ts";

export type NetRole = 'host' | 'guest';

/** What the host knows about a guest */
export type GuestInfo = { ship: number, stats: PlayerStats };

type ServerMessage =
    | { t: 'welcome', id: number }
    | { t: 'room', code: string, hostId: number, players: number[] }
    | { t: 'joined', id: number, players: number[] }
    | { t: 'left', id: number, players: number[] }
    | { t: 'closed' }
    | { t: 'error', reason: 'unknown' | 'full' }
    | { t: 'relay', from: number, data: GuestMessage | HostMessage };

/**
 * Connection to the coop room server. One instance for the whole page: the room outlives the scenes.
 * Events: ROOM_EVENT, PLAYERS_EVENT, CLOSED_EVENT, ERROR_EVENT, MESSAGE_EVENT (from, data).
 */
class Net extends Phaser.Events.EventEmitter {
    public static readonly MAX_PLAYERS: number = 4;

    public readonly ROOM_EVENT = 'room';
    /** (players: number[]) someone joined or left */
    public readonly PLAYERS_EVENT = 'players';
    public readonly CLOSED_EVENT = 'closed';
    /** (reason: string) */
    public readonly ERROR_EVENT = 'error';
    /** (from: number, data: GuestMessage | HostMessage) */
    public readonly MESSAGE_EVENT = 'message';

    private _socket: WebSocket | null = null;
    private _connecting: Promise<void> | null = null;
    private _myId: number = 0;
    private _hostId: number = 0;
    private _code: string = '';
    private _players: number[] = [];
    /** Host only: ship and stats of each guest, from their hello */
    public readonly guests: Map<number, GuestInfo> = new Map();
    /** Guest only: players as announced by the host */
    public lobby: LobbyPlayer[] = [];

    public get role(): NetRole | null {
        if (!this._code)
            return null;
        return this._myId === this._hostId ? 'host' : 'guest';
    }

    public get myId(): number {
        return this._myId;
    }

    public get hostId(): number {
        return this._hostId;
    }

    public get code(): string {
        return this._code;
    }

    /** Room ids, host first */
    public get players(): number[] {
        return [this._hostId, ...this._players.filter(id => id !== this._hostId)];
    }

    public connect(): Promise<void> {
        if (this._socket?.readyState === WebSocket.OPEN)
            return Promise.resolve();
        if (this._connecting)
            return this._connecting;

        const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
        this._connecting = new Promise<void>((resolve, reject) => {
            const socket = new WebSocket(`${protocol}://${location.host}/ws`);
            socket.onmessage = (event) => {
                const message = JSON.parse(event.data) as ServerMessage;
                if (message.t === 'welcome') {
                    this._myId = message.id;
                    resolve();
                }
                this.onServerMessage(message);
            };
            socket.onerror = () => reject(new Error('connection failed'));
            socket.onclose = () => {
                this._socket = null;
                this._connecting = null;
                if (this._code)
                    this.onServerMessage({t: 'closed'});
            };
            this._socket = socket;
        });
        this._connecting.catch(() => this._connecting = null);
        return this._connecting;
    }

    public async create() {
        await this.connect();
        this.guests.clear();
        this.raw({t: 'create'});
    }

    public async join(code: string) {
        await this.connect();
        this.raw({t: 'join', code});
    }

    public leave() {
        if (this._code)
            this.raw({t: 'leave'});
        this.reset();
    }

    /** Guest to host */
    public sendToHost(data: GuestMessage) {
        this.raw({t: 'relay', to: this._hostId, data});
    }

    /** Host to every guest, or to one */
    public sendToGuests(data: HostMessage, to?: number) {
        this.raw(to === undefined ? {t: 'relay', data} : {t: 'relay', to, data});
    }

    private raw(message: object) {
        if (this._socket?.readyState === WebSocket.OPEN)
            this._socket.send(JSON.stringify(message));
    }

    private reset() {
        this._code = '';
        this._hostId = 0;
        this._players = [];
        this.guests.clear();
        this.lobby = [];
    }

    private onServerMessage(message: ServerMessage) {
        switch (message.t) {
            case 'room':
                this._code = message.code;
                this._hostId = message.hostId;
                this._players = message.players;
                this.emit(this.ROOM_EVENT);
                break;
            case 'joined':
            case 'left':
                this._players = message.players;
                if (message.t === 'left')
                    this.guests.delete(message.id);
                this.emit(this.PLAYERS_EVENT, this.players);
                break;
            case 'closed':
                this.reset();
                this.emit(this.CLOSED_EVENT);
                break;
            case 'error':
                this.emit(this.ERROR_EVENT, message.reason);
                break;
            case 'relay':
                if (message.data && (message.data as GuestMessage).k === 'hello' && this.role === 'host') {
                    const hello = message.data as Extract<GuestMessage, { k: 'hello' }>;
                    this.guests.set(message.from, {ship: hello.ship, stats: hello.stats});
                }
                if (message.data && (message.data as HostMessage).k === 'lobby')
                    this.lobby = (message.data as Extract<HostMessage, { k: 'lobby' }>).players;
                this.emit(this.MESSAGE_EVENT, message.from, message.data);
                break;
        }
    }
}

export default new Net();
