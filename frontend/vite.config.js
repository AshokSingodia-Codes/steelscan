import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: [
        'favicon.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
      ],

      manifest: {
        name: 'STEELSCAN — Industrial OCR System',
        short_name: 'STEELSCAN',
        description: 'Industrial steel coil OCR scanner system',

        theme_color: '#F4F5F7',
        background_color: '#F4F5F7',

        display: 'standalone',
        orientation: 'portrait',

        // Good for PWA: app opens scanner directly.
        // ProtectedRoute will send user to login if not authenticated.
        start_url: '/scanner',
        scope: '/',

        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],

        runtimeCaching: [
          {
            // Never cache backend/API calls.
            // This supports localhost, LAN IP, Cloudflare tunnel, and later deployed API.
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/auth') ||
              url.pathname.startsWith('/scan') ||
              url.pathname.startsWith('/records') ||
              url.pathname.startsWith('/admin') ||
              url.pathname.startsWith('/metrics') ||
              url.pathname.startsWith('/health'),

            handler: 'NetworkOnly',

            options: {
              cacheName: 'steelscan-api-network-only',
            },
          },
        ],
      },

      // Enable PWA in dev because you are testing mobile/PWA behavior now.
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],

  server: {
    host: '0.0.0.0',
    port: 3001,

    // Important for Cloudflare quick tunnel.
    // Without this, Vite blocks:
    // incoming-locks-charger-engine.trycloudflare.com
    allowedHosts: true,
  },

  preview: {
    host: '0.0.0.0',
    port: 3001,
    allowedHosts: true,
  },
})