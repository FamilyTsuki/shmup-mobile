// Coop server: serves the built game (dist/) and relays messages between the players of a room.
// Also keeps the endless mode leaderboard (scores.mjs, /api/scores).
// The host's browser runs the game; this server only forwards messages, it knows nothing about the game.
//
//   npm run build && npm run server        production, one port for the game and the WebSocket
//   npm run server                         development, next to Vite which proxies /ws here

import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, join, normalize, resolve} from 'node:path';
import {WebSocketServer} from 'ws';
import {handleScores} from './scores.mjs';

const PORT = Number(process.env.PORT ?? 3001);
const DIST = resolve(import.meta.dirname, '..', 'dist');
const MAX_PLAYERS = 4;
const CODE_LENGTH = 4;
/** Biggest message accepted from a browser: a snapshot with every bullet on screen fits well below */
const MAX_PAYLOAD = 256 * 1024;
/** Testing only: delays each relayed message by up to this many ms, in order, like a busy Wi-Fi */
const JITTER_MS = Number(process.env.JITTER_MS ?? 0);

const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.ogg': 'audio/ogg', '.ttf': 'font/ttf', '.xml': 'application/xml',
    '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
};

// ---------------------------------------------------------------- static files

const server = createServer(async (request, response) => {
    try {
        const url = new URL(request.url ?? '/', 'http://localhost');
        if (await handleScores(request, response, url))
            return;

        const path = decodeURIComponent(url.pathname);
        // normalize() resolves "..": the file must stay inside dist/
        let file = normalize(join(DIST, path));
        if (!file.startsWith(DIST)) {
            response.writeHead(403).end();
            return;
        }
        if ((await stat(file).catch(() => null))?.isDirectory())
            file = join(file, 'index.html');

        const body = await readFile(file);
        response.writeHead(200, {'Content-Type': MIME[extname(file)] ?? 'application/octet-stream'}).end(body);
    } catch {
        response.writeHead(404).end('Not found');
    }
});

// ---------------------------------------------------------------- rooms

/** @type {Map<string, {hostId: number, players: Map<number, import('ws').WebSocket>}>} */
const rooms = new Map();
let nextId = 1;

function newCode() {
    let code;
    do {
        code = String(Math.floor(Math.random() * 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0');
    } while (rooms.has(code));
    return code;
}

function send(socket, message) {
    if (socket.readyState === socket.OPEN)
        socket.send(JSON.stringify(message));
}

/** Like send, with the simulated jitter of JITTER_MS; messages to one socket keep their order */
function relay(socket, message) {
    if (JITTER_MS <= 0) {
        send(socket, message);
        return;
    }
    const at = Math.max(socket.nextRelayAt ?? 0, Date.now() + Math.random() * JITTER_MS);
    socket.nextRelayAt = at;
    setTimeout(() => send(socket, message), at - Date.now());
}

function playerIds(room) {
    return [...room.players.keys()];
}

function leave(socket) {
    const code = socket.roomCode;
    const room = rooms.get(code);
    if (!room)
        return;

    room.players.delete(socket.playerId);
    socket.roomCode = null;

    // Without its host a room cannot go on: everyone goes back to the menu
    if (socket.playerId === room.hostId || room.players.size === 0) {
        room.players.forEach(other => {
            send(other, {t: 'closed'});
            other.roomCode = null;
        });
        rooms.delete(code);
        return;
    }
    room.players.forEach(other => send(other, {t: 'left', id: socket.playerId, players: playerIds(room)}));
}

const sockets = new WebSocketServer({server, path: '/ws', maxPayload: MAX_PAYLOAD});

sockets.on('connection', (socket) => {
    socket.playerId = nextId++;
    socket.roomCode = null;
    send(socket, {t: 'welcome', id: socket.playerId});

    socket.on('message', (raw) => {
        let message;
        try {
            message = JSON.parse(String(raw));
        } catch {
            return;
        }

        switch (message.t) {
            case 'create': {
                leave(socket);
                const code = newCode();
                rooms.set(code, {hostId: socket.playerId, players: new Map([[socket.playerId, socket]])});
                socket.roomCode = code;
                send(socket, {t: 'room', code, hostId: socket.playerId, players: [socket.playerId]});
                break;
            }
            case 'join': {
                const code = String(message.code ?? '');
                const room = rooms.get(code);
                if (!room) {
                    send(socket, {t: 'error', reason: 'unknown'});
                    return;
                }
                if (room.players.size >= MAX_PLAYERS) {
                    send(socket, {t: 'error', reason: 'full'});
                    return;
                }
                leave(socket);
                room.players.set(socket.playerId, socket);
                socket.roomCode = code;
                const players = playerIds(room);
                send(socket, {t: 'room', code, hostId: room.hostId, players});
                room.players.forEach((other, id) => {
                    if (id !== socket.playerId)
                        send(other, {t: 'joined', id: socket.playerId, players});
                });
                break;
            }
            case 'leave':
                leave(socket);
                break;
            case 'relay': {
                // Game data: to one player, or to everyone else in the room
                const room = rooms.get(socket.roomCode);
                if (!room)
                    return;
                const forward = {t: 'relay', from: socket.playerId, data: message.data};
                if (typeof message.to === 'number') {
                    const target = room.players.get(message.to);
                    if (target)
                        relay(target, forward);
                } else
                    room.players.forEach((other, id) => id !== socket.playerId && relay(other, forward));
                break;
            }
        }
    });

    socket.on('close', () => leave(socket));
});

server.listen(PORT, () => console.log(`Coop server on http://localhost:${PORT} (game from ${DIST}, WebSocket on /ws)`));
