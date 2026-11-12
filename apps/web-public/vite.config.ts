import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API = process.env.API_URL ?? 'http://127.0.0.1:3000';

// El sitio público solo enruta /api/public y /medios. /api/admin no existe aquí.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    proxy: {
      '/api/public': { target: API },
      '/medios': { target: API },
    },
  },
  // Vista previa de la compilación, para compartir por un túnel (cloudflared) con quien prueba.
  preview: { port: 4173, strictPort: true, allowedHosts: ['.trycloudflare.com'], proxy: { '/api/public': { target: API }, '/medios': { target: API } } },
  build: { target: 'es2022', sourcemap: false },
});
