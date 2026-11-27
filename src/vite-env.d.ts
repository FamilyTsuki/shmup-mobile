/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Origin of the Node server when the game is hosted elsewhere (itch.io build), see net/Server.ts */
    readonly VITE_SERVER_URL?: string;
}
