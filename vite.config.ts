import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Recibe las notificaciones push y abre la app al tocarlas
        importScripts: ['/push-sw.js'],
        navigateFallbackDenylist: [/^\/api\//],
        // Los módulos de mapas y herramientas secundarias se cargan bajo demanda.
        // Se cachean al visitarlos, sin obligar a descargar todo al instalar la PWA.
        globIgnores: ['**/src-*.js', '**/MapaLugar-*.js'],
        runtimeCaching: [{
          urlPattern: ({ request, url }) => request.destination === 'script' && url.pathname.startsWith('/assets/'),
          handler: 'CacheFirst',
          options: { cacheName: 'modulos-app', expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 } },
        }],
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'You and me 💚',
        short_name: 'You & me',
        description: 'Para nosotros dos',
        // bosque y crema de src/index.css: la pantalla de carga y la barra del sistema van con la app
        theme_color: '#1F6B4A',
        background_color: '#F1F6EE',
        display: 'standalone',
        // Tocar el ícono sin soltar
        shortcuts: [
          { name: 'Pienso en ti', short_name: 'Pienso en ti', url: '/?pienso=1', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
          { name: 'Pregunta del día', short_name: 'Pregunta', url: '/preguntas', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
          { name: 'Nuevo recuerdo', short_name: 'Recuerdo', url: '/historia?nuevo=1', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
          { name: 'Planear una cita', short_name: 'Cita', url: '/citas?nueva=1', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
        ],
        // Compartir a la app desde la galería, Spotify… (lo recibe public/push-sw.js)
        share_target: {
          action: '/compartir',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: { title: 'title', text: 'text', url: 'url', files: [{ name: 'archivos', accept: ['image/*', 'video/*'] }] },
        },
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
});
