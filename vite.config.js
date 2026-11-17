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
    rollupOptions: {
      output: {
        // three.js is the bulk of the bundle; keep it in its own long-cacheable chunk
        // so game-code changes don't invalidate it.
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
        },
      },
    },
    // three.js alone is ~700 kB minified; it loads lazily, after the menu paints.
    chunkSizeWarningLimit: 800,
  },
});
