import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Allows testing on phones/tablets on the same network: npm run dev -- --host
    host: false,
  },
  build: {
    target: 'es2022',
    // three.js + R3F make up most of the bundle (~1.1 MB min / ~320 kB gzip).
    // Revisit vendor chunk splitting once gameplay code grows.
    chunkSizeWarningLimit: 1300,
  },
});
