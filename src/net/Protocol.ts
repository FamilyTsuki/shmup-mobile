import type {PlayerStats} from "../gameData/UpgradeData.ts";
import type {Polarity} from "../gameData/PolarityData.ts";
import type {RunResultData} from "../scenes/MainGameScene.ts";

/**
 * Game messages exchanged through the room server (which only relays them).
 * The host runs the game; guests send their inputs and draw what the host sends.
 */

/** Guest to host */
export type GuestMessage =
    /** Sent when joining: which ship and which upgrades the guest plays with */
    | { k: 'hello', ship: number, stats: PlayerStats }
    | { k: 'input', s: NetInput }
    | { k: 'bomb' };

/** Host to guests */
export type HostMessage =
    | { k: 'lobby', players: LobbyPlayer[] }
    | { k: 'start', level: number }
    | { k: 'snap', s: Snapshot }
    | { k: 'fx', e: FxEvent[] }
    | { k: 'end', result: RunResultData }
    /** The host left the game: back to the room */
    | { k: 'abort' };

export type LobbyPlayer = { id: number, index: number, ship: number };

/**
 * A guest's input. The guest moves its own ship locally (no lag on its own ship) and sends the position.
 */
export type NetInput = {
    /** Guest clock when sent, to replay its moves smoothly on the host */
    t: number;
    x: number;
    fire: boolean;
    /** Number of polarity switch requests since the last message */
    switches: number;
};

/**
 * One drawn object: [id, texture, x, y, rotation x100, scaleX x100, scaleY x100, alpha x100, tint, white flash, depth].
 * Generic on purpose: guests do not need to know what an enemy or a bullet is to draw it.
 */
export type SyncObject = [number, number, number, number, number, number, number, number, number, number, number];

export type SnapPlayer = {
    /** Room id of the player who controls the ship */
    id: number;
    /** P1..P4 */
    index: number;
    /** Sync ids of the ship and the images following it (aura, shield): guests move their own ones locally */
    objects: number[];
    lives: number;
    resonance: number;
    polarity: Polarity;
    alive: boolean;
    /** Coop: dead but still flying around, waiting for a revive */
    ghost: boolean;
};

export type HudState = {
    score: number;
    combo: number;
    credits: number;
    bombs: number;
    bossHealth: number;
    bossName: string;
    bossPolarity: Polarity;
    kills: number;
};

export type Snapshot = {
    /** Host time in ms */
    t: number;
    /** Texture keys first used in this snapshot: [index, key] */
    keys?: [number, string][];
    objects: SyncObject[];
    players: SnapPlayer[];
    hud: HudState;
};

/**
 * Something guests replay on their side: [target, method, arguments, only for this room id].
 * effects / sfx / sound / camera / hud (banner, hint, dialogue)
 */
export type FxEvent = [string, string, unknown[], number?];
