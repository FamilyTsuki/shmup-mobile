/**
 * Where the Node server (server/index.mjs) lives: coop WebSocket, leaderboard, public page of the game.
 * Default: the origin of the page, when the server serves the game itself.
 * VITE_SERVER_URL (.env.itch) points to it when the game is hosted elsewhere, such as on itch.io.
 */
const ORIGIN: string = (import.meta.env.VITE_SERVER_URL ?? location.origin).replace(/\/+$/, '');

export default class Server {
    /** True when the game is not served by the Node server */
    public static readonly REMOTE: boolean = !!import.meta.env.VITE_SERVER_URL;

    /** HTTP(S) URL of a server path, like "/api/scores" */
    public static http(path: string): string {
        return Server.REMOTE ? `${ORIGIN}${path}` : `.${path}`;
    }

    /** ws:// or wss:// URL of a server path, like "/ws" */
    public static ws(path: string): string {
        return `${ORIGIN.replace(/^http/, 'ws')}${path}`;
    }

    /** Public page of the game, without query: the one served by the Node server */
    public static pageUrl(): string {
        return Server.REMOTE ? `${ORIGIN}/` : `${location.origin}${location.pathname}`;
    }
}
