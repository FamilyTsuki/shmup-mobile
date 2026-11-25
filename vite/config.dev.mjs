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
            allowedHosts: ['game.tsuki-dev.fr']
        },
        plugins: mobile ? [basicSsl()] : []
    };
});
