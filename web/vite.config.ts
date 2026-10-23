import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El servidor del runtime escucha solo en 127.0.0.1 (ver docs/runtime-pilot.md).
// El proxy evita tener que habilitar CORS en ese servidor minimalista: el navegador
// solo habla con el origen de Vite, y Vite reenvía /api por su propio proceso Node.
const apiTarget = process.env.VERIDIS_RUNTIME_API ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
