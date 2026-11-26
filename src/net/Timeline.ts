export type TimelineSample<T> = {
    older: T;
    newer: T;
    /** Position between older (0) and newer (1); a little above 1 when extrapolating a late message */
    blend: number;
};

/**
 * Smooths a stream of timestamped states sent by another device, whatever the network jitter.
 *
 * Messages are placed on the sender's clock, not on their arrival time: Wi-Fi delivers them in bursts,
 * and blending by arrival time makes things stutter. The clock offset is the smallest (arrival - sent) seen
 * lately: the least delayed message. States are then replayed a little in the past, the delay adapting
 * to the jitter measured, so there is almost always a state on each side of the time drawn.
 */
export default class Timeline<T> {
    /**
     * True when a periodic message is due. Frames do not split time evenly (2 frames at 60 fps are 33.3 ms,
     * a hair under 1000 / 30): a few ms of tolerance and keeping the remainder hold the intended rate.
     */
    public static due(elapsedMs: number, intervalMs: number): boolean {
        return elapsedMs >= intervalMs - Timeline.FRAME_TOLERANCE_MS;
    }

    private static readonly FRAME_TOLERANCE_MS: number = 4;
    private static readonly OFFSET_SAMPLES: number = 90;
    private static readonly MAX_ENTRIES: number = 40;
    private static readonly MIN_DELAY_MS: number = 40;
    private static readonly MAX_DELAY_MS: number = 300;
    /** When messages are late, keep moving at most this far past the last one, in fractions of a gap */
    private static readonly MAX_EXTRAPOLATION: number = 0.5;

    private readonly _sendIntervalMs: number;
    private _entries: { t: number, value: T }[] = [];
    private _offsets: number[] = [];
    private _offset: number = 0;
    private _delay: number = Timeline.MAX_DELAY_MS;

    /**
     * @param sendIntervalMs how often the other device sends a state
     */
    constructor(sendIntervalMs: number) {
        this._sendIntervalMs = sendIntervalMs;
    }

    /** Current replay delay, for debugging */
    public get delayMs(): number {
        return this._delay;
    }

    public get latest(): T | null {
        return this._entries.length > 0 ? this._entries[this._entries.length - 1].value : null;
    }

    /**
     * @param sentAt the sender's clock when it sent the state, in ms
     */
    public push(sentAt: number, value: T) {
        this._offsets.push(performance.now() - sentAt);
        if (this._offsets.length > Timeline.OFFSET_SAMPLES)
            this._offsets.shift();

        const sorted = [...this._offsets].sort((a, b) => a - b);
        this._offset = sorted[0];
        // 90th percentile of the extra delay: rare spikes do not slow everything down
        const jitter = sorted[Math.floor(sorted.length * 0.9)] - sorted[0];
        this._delay = Phaser.Math.Clamp(this._sendIntervalMs + jitter + 10, Timeline.MIN_DELAY_MS, Timeline.MAX_DELAY_MS);

        // The sender's clock never goes back; ignore what would (a restart of the sender)
        const last = this._entries[this._entries.length - 1];
        if (last && sentAt <= last.t) {
            if (sentAt < last.t - 1000)
                this.clear();
            else
                return;
        }
        this._entries.push({t: sentAt, value});
        if (this._entries.length > Timeline.MAX_ENTRIES)
            this._entries.shift();
    }

    public clear() {
        this._entries = [];
        this._offsets = [];
    }

    /** The two states around the time to draw now, or null before the first message */
    public sample(): TimelineSample<T> | null {
        const entries = this._entries;
        if (entries.length === 0)
            return null;
        if (entries.length === 1)
            return {older: entries[0].value, newer: entries[0].value, blend: 1};

        const at = performance.now() - this._offset - this._delay;
        if (at <= entries[0].t)
            return {older: entries[0].value, newer: entries[0].value, blend: 1};

        for (let i = entries.length - 2; i >= 0; i--) {
            if (entries[i].t <= at) {
                const older = entries[i];
                const newer = entries[i + 1];
                const blend = (at - older.t) / (newer.t - older.t);
                // Past the last state: messages are late, carry on a little in the same direction
                return {older: older.value, newer: newer.value, blend: Math.min(blend, 1 + Timeline.MAX_EXTRAPOLATION)};
            }
        }
        return {older: entries[0].value, newer: entries[0].value, blend: 1};
    }
}
