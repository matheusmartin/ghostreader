/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base: the built app works from any folder (GitHub Pages, a sub-path, a local server).
export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      // 'prompt': a new version waits until the reader goes back to the library (see src/pwa.ts),
      // so an update never reloads the page in the middle of a chapter.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Ghostreader',
        short_name: 'Ghostreader',
        description: 'Read books with charts, infographics and summaries.',
        lang: 'en',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        background_color: '#fafafa',
        theme_color: '#fafafa',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app and every book, so the whole library works offline.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        // A PDF opened in a tab is a navigation too: never answer it with the app.
        navigateFallbackDenylist: [/\/pdf\//],
        // PDFs are built after the app, so they are not precached: keep each one once downloaded.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/pdf/') && url.pathname.endsWith('.pdf'),
            handler: 'NetworkFirst',
            options: { cacheName: 'pdf', expiration: { maxEntries: 30 } },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
