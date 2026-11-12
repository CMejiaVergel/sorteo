import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API = process.env.API_URL ?? 'http://127.0.0.1:3000';

// El panel enruta /api/admin y /medios. Nunca se enlaza desde el sitio público.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api/admin': { target: API },
      '/medios': { target: API },
    },
    headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' },
  },
  // Vista previa de la compilación, para que el dueño pruebe el panel por un túnel (cloudflared).
  preview: {
    port: 4174,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com'],
    proxy: { '/api/admin': { target: API }, '/medios': { target: API } },
    headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' },
  },
  build: { target: 'es2022', sourcemap: false },
});
