import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `--mode mobile` serves over HTTPS on the local network so a phone can reach it:
// browsers only expose the gyroscope to secure pages.
export default defineConfig(({ mode }) => {
    const mobile = mode === 'mobile';

    return {
        base: './',
        build: {
            rollupOptions: {
                output: {
                    manualChunks: {
                        phaser: ['phaser']
                    }
                }
            },
        },
        server: {
            port: 8080,
            host: mobile,
            // Reached through the Cloudflare tunnel
            allowedHosts: ['game.tsuki-dev.fr'],
            // Coop rooms: the WebSocket goes to the Node server (npm run server)
            proxy: {
                '/ws': {target: 'ws://localhost:3001', ws: true}
            }
        },
        // `vite preview`: the production build, served like the dev server (HTTPS on the network with --mode mobile)
        preview: {
            port: 8081,
            host: mobile,
            allowedHosts: ['game.tsuki-dev.fr'],
            proxy: {
                '/ws': {target: 'ws://localhost:3001', ws: true}
            }
        },
        plugins: mobile ? [basicSsl()] : []
    };
});
