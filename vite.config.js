import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    base: process.env.VITE_BASE_PATH || '/',
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                navigateFallback: '/offline.html',
                navigateFallbackDenylist: [/^\/api\//],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/0\.peerjs\.com\//,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'peerjs-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 // 24 hours
                            }
                        }
                    },
                    {
                        urlPattern: /^https:\/\/api\.qrserver\.com\//,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'qr-cache',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
                            }
                        }
                    }
                ]
            },
            manifest: {
                name: 'Peer P2P Voice Chat',
                short_name: 'PeerChat',
                description: 'Local Wi-Fi P2P voice chat using WebRTC (PeerJS)',
                theme_color: '#0f172a',
                background_color: '#0f172a',
                display: 'standalone',
                orientation: 'portrait-primary',
                scope: '/',
                start_url: '/',
                lang: 'en',
                categories: ['communication', 'social'],
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any maskable'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    },
                    {
                        src: 'apple-touch-icon.png',
                        sizes: '180x180',
                        type: 'image/png'
                    }
                ],
                shortcuts: [
                    {
                        name: 'Start Voice Chat',
                        short_name: 'Voice Chat',
                        description: 'Start a new voice chat session',
                        url: '/?action=call',
                        icons: [
                            {
                                src: 'pwa-192x192.png',
                                sizes: '192x192'
                            }
                        ]
                    }
                ]
            },
            devOptions: {
                enabled: true
            }
        })
    ],
    server: {
        host: true,
        port: 5173
    }
})
