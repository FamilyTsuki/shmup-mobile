// Endless mode leaderboard: the best run of each nickname, kept in a JSON file.
//
//   GET  /api/scores?limit=10                    top scores, best first
//   POST /api/scores {name, score, stage}        -> {rank, best}
//
// SCORES_FILE sets the file (default data/scores.json). Delete it to reset the leaderboard.
// Scores are trusted as sent: fine for a class game jam, not for a public game.

import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';

const FILE = process.env.SCORES_FILE ?? resolve(import.meta.dirname, '..', 'data', 'scores.json');
const NAME_PATTERN = /^[A-Z0-9 _-]{1,12}$/;
const MAX_SCORE = 100_000_000;
const MAX_STAGE = 9999;
const MAX_LIMIT = 50;
const MAX_ENTRIES = 1000;
const MAX_BODY = 1024;

/** @type {{name: string, score: number, stage: number, date: string}[]} best first */
let entries = [];
/** Writes one after the other, so an older list never overwrites a newer one */
let saving = Promise.resolve();

try {
    entries = JSON.parse(await readFile(FILE, 'utf8'));
    console.log(`Leaderboard: ${entries.length} scores from ${FILE}`);
} catch {
    console.log(`Leaderboard: new file ${FILE}`);
}

function save() {
    const json = JSON.stringify(entries, null, 1);
    saving = saving
        .then(() => mkdir(dirname(FILE), {recursive: true}))
        .then(() => writeFile(FILE, json))
        .catch(error => console.error('Leaderboard save failed', error));
}

function json(response, status, body) {
    response.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'})
        .end(JSON.stringify(body));
}

function readBody(request) {
    return new Promise((done, fail) => {
        let body = '';
        request.on('data', chunk => {
            body += chunk;
            if (body.length > MAX_BODY) {
                fail(new Error('too large'));
                request.destroy();
            }
        });
        request.on('end', () => done(body));
        request.on('error', fail);
    });
}

/** Checks the sent run; null when it is not valid */
function parseEntry(body) {
    let data;
    try {
        data = JSON.parse(body);
    } catch {
        return null;
    }
    const name = String(data?.name ?? '').trim().toUpperCase();
    const {score, stage} = data ?? {};
    if (!NAME_PATTERN.test(name) || !Number.isInteger(score) || score < 0 || score > MAX_SCORE
        || !Number.isInteger(stage) || stage < 1 || stage > MAX_STAGE)
        return null;
    return {name, score, stage};
}

/** Keeps the best run of the nickname. @returns {{rank: number, best: boolean}} */
function addEntry(entry) {
    const index = entries.findIndex(other => other.name === entry.name);
    const best = index < 0 || entry.score > entries[index].score;
    if (best) {
        if (index >= 0)
            entries.splice(index, 1);
        entries.push({...entry, date: new Date().toISOString()});
        entries.sort((a, b) => b.score - a.score || b.stage - a.stage);
        entries.length = Math.min(entries.length, MAX_ENTRIES);
        save();
    }
    // Rank of this run among the best runs, even when it is not the player's record
    const rank = entries.filter(other => other.score > entry.score).length + 1;
    return {rank, best};
}

/** @returns true when the request was for the leaderboard */
export async function handleScores(request, response, url) {
    if (url.pathname !== '/api/scores')
        return false;

    if (request.method === 'GET') {
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 10, 1), MAX_LIMIT);
        json(response, 200, entries.slice(0, limit).map(({name, score, stage}) => ({name, score, stage})));
    } else if (request.method === 'POST') {
        const entry = parseEntry(await readBody(request).catch(() => ''));
        if (entry)
            json(response, 200, addEntry(entry));
        else
            json(response, 400, {error: 'invalid'});
    } else {
        response.writeHead(405).end();
    }
    return true;
}
