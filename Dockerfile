# Coop server image: builds the game, then serves it with the room WebSocket on one port.
# Cosmo Cloud runs it; a Cloudflare Tunnel maps the public domain to http://localhost:3001 (HTTPS and wss by Cloudflare).
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build-nolog

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist
ENV PORT=3001
EXPOSE 3001
CMD ["node", "server/index.mjs"]
