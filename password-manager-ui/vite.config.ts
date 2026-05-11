import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'

const certDir = path.resolve(__dirname, 'certs')
const httpsKeyPath = path.join(certDir, 'vite-dev.key')
const httpsCertPath = path.join(certDir, 'vite-dev.crt')
const hasHttpsCert = fs.existsSync(httpsKeyPath) && fs.existsSync(httpsCertPath)
const routePageMap: Record<string, string> = {
    favorites: 'favorite-page.html',
    accounts: 'accounts-page.html',
    notes: 'notes-page.html',
    totp: 'totp-page.html',
    'password-generator': 'password-generator-page.html',
    settings: 'settings-page.html',
    login: 'login-page.html',
    register: 'register-page.html',
    loading: 'loading-page.html'
}

export default defineConfig({
    clearScreen: false,
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
    envPrefix: ['VITE_'],
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        target: 'es2020',
        minify: 'esbuild',
        sourcemap: false,
        rollupOptions: {
            input: {
                index: path.resolve(__dirname, 'src/index.html'),
                'favorites/index': path.resolve(__dirname, 'src/pages/favorite-page.html'),
                'accounts/index': path.resolve(__dirname, 'src/pages/accounts-page.html'),
                'notes/index': path.resolve(__dirname, 'src/pages/notes-page.html'),
                'totp/index': path.resolve(__dirname, 'src/pages/totp-page.html'),
                'password-generator/index': path.resolve(__dirname, 'src/pages/password-generator-page.html'),
                'settings/index': path.resolve(__dirname, 'src/pages/settings-page.html'),
                'login/index': path.resolve(__dirname, 'src/pages/login-page.html'),
                'register/index': path.resolve(__dirname, 'src/pages/register-page.html'),
                'loading/index': path.resolve(__dirname, 'src/pages/loading-page.html')
            }
        }
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
                    '/password-generator': '/pages/password-generator-page.html',
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
        },
        {
            name: 'emit-route-directories',
            closeBundle() {
                const distDir = path.resolve(__dirname, 'dist')
                const pagesDir = path.join(distDir, 'pages')

                if (!fs.existsSync(pagesDir)) {
                    return
                }

                for (const [route, pageFile] of Object.entries(routePageMap)) {
                    const source = path.join(pagesDir, pageFile)
                    if (!fs.existsSync(source)) {
                        continue
                    }

                    const targetDir = path.join(distDir, route)
                    fs.mkdirSync(targetDir, { recursive: true })
                    fs.copyFileSync(source, path.join(targetDir, 'index.html'))
                }
            }
        }
    ]
})
