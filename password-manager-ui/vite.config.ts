import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'

const certDir = path.resolve(__dirname, 'certs')
const httpsKeyPath = path.join(certDir, 'vite-dev.key')
const httpsCertPath = path.join(certDir, 'vite-dev.crt')
const hasHttpsCert = fs.existsSync(httpsKeyPath) && fs.existsSync(httpsCertPath)

export default defineConfig({
    // prevent vite from obscuring rust errors
    clearScreen: false,
    // Tauri expects a fixed port, fail if that port is not available
    root: 'src',
    server: {
        host: '0.0.0.0',
        https: hasHttpsCert
            ? {
                key: fs.readFileSync(httpsKeyPath),
                cert: fs.readFileSync(httpsCertPath),
            }
            : undefined,
        proxy: {
            '/api': {
                target: 'https://192.168.0.101:7163',
                changeOrigin: true,
                secure: false,
                xfwd: true
            }
        },
        strictPort: true,
        port: 3000
    },
    // to access the Tauri environment variables set by the CLI with information about the current target
    envPrefix: ['VITE_', 'TAURI_PLATFORM', 'TAURI_ARCH', 'TAURI_FAMILY', 'TAURI_PLATFORM_VERSION', 'TAURI_PLATFORM_TYPE', 'TAURI_DEBUG'],
    build: {
        // Tauri uses Chromium on Windows and WebKit on macOS and Linux
        target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
        // don't minify for debug builds
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        // produce sourcemaps for debug builds
        sourcemap: !!process.env.TAURI_DEBUG,
    },
    plugins: [
        {
            name: 'pretty-routes',
            configureServer(server) {
                const rewrites: Record<string, string> = {
                    '/': '/index.html',
                    '/favorites': '/pages/favorite-page.html',
                    '/accounts': '/pages/accounts-page.html',
                    '/notes': '/pages/notes-page.html',
                    '/totp': '/pages/totp-page.html',
                    '/settings': '/pages/settings-page.html',
                    '/login': '/pages/login-page.html',
                    '/register': '/pages/register-page.html',
                    '/loading': '/pages/loading-page.html'
                };

                server.middlewares.use((req, _res, next) => {
                    if (!req.url) {
                        next();
                        return;
                    }

                    const [pathname] = req.url.split('?');
                    const rewriteTarget = rewrites[pathname];
                    if (rewriteTarget) {
                        req.url = rewriteTarget;
                    }

                    next();
                });
            }
        }
    ]
})
