#!/bin/sh
# Cosmos server entry point: the repo is bind-mounted in /app of a node:22-alpine container.
# Installs, builds the game, then serves it with the coop WebSocket and the leaderboard on $PORT.
set -e
npm ci
npm run build-nolog
exec node server/index.mjs
