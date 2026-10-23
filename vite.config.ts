import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Consultório · Juliana Feliciano',
        short_name: 'Consultório',
        lang: 'pt-BR',
        theme_color: '#1D5C68',
        background_color: '#F6F3EA',
        display: 'standalone',
        icons: [
          { src: '/marca/icone-192.png', sizes: '192x192', type: 'image/png' },
          {
            src: '/marca/icone-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
});
