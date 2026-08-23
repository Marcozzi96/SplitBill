import { fileURLToPath, URL } from 'node:url'
import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'SplitBill',
        short_name: 'SplitBill',
        description: 'Dividi le spese con amici e gruppi',
        start_url: '/',
        theme_color: '#0a1020',
        background_color: '#0a1020',
        display: 'standalone',
        icons: [
          { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  // Porta 3000: in dev il CORS del backend ammette http://localhost:3000.
  // host: true permette il test da smartphone in LAN (vite --host).
  server: { host: true, port: 3000 },
  test: {
    environment: 'jsdom',
    globals: true,
    // Gli spec E2E (Playwright) vivono in e2e/ e non devono girare sotto Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
