/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'SplitBill',
        short_name: 'SplitBill',
        description: 'Dividi le spese con amici e gruppi',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [],
      },
    }),
  ],
  // Porta 3000: in dev il CORS del backend ammette http://localhost:3000.
  // host: true permette il test da smartphone in LAN (vite --host).
  server: { host: true, port: 3000 },
  test: { environment: 'jsdom', globals: true },
})
