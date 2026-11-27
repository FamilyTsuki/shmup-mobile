import Server from "./Server.ts";

/** One line of the leaderboard: the best run of a nickname */
export type ScoreEntry = {
    name: string;
    score: number;
    stage: number;
};

export type SubmitResult = {
    /** 1 for the first place */
    rank: number;
    /** False when this nickname already had a better score */
    best: boolean;
};

/**
 * Endless mode leaderboard, kept by the Node server (server/index.mjs). Every call resolves to null
 * when the server cannot be reached, so the game goes on offline.
 */
export default class Leaderboard {
    private static readonly URL: string = Server.http('/api/scores');
    private static readonly TIMEOUT_MS: number = 5000;

    public static async top(limit: number): Promise<ScoreEntry[] | null> {
        const response = await Leaderboard.request(`${Leaderboard.URL}?limit=${limit}`);
        return response ? response.json() : null;
    }

    public static async submit(entry: ScoreEntry): Promise<SubmitResult | null> {
        const response = await Leaderboard.request(Leaderboard.URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(entry),
        });
        return response ? response.json() : null;
    }

    private static async request(url: string, init: RequestInit = {}): Promise<Response | null> {
        try {
            const response = await fetch(url, {...init, signal: AbortSignal.timeout(Leaderboard.TIMEOUT_MS)});
            return response.ok ? response : null;
        } catch {
            return null;
        }
    }
}
