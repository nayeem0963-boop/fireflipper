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
    // Vendor code is split from the application so a code-only deploy leaves the (large, rarely changing) library chunks with the same
    // fingerprinted file names, and returning visitors keep them cached (see public/_headers). Three groups, so none is needlessly large:
    // React (with the small state library), three.js (with its helpers) and the react-three-fiber renderer glue.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler|zustand|use-sync-external-store)[\\/]/, priority: 30 },
            { name: 'vendor-three', test: /node_modules[\\/](three|three-stdlib)[\\/]/, priority: 20 },
            { name: 'vendor-r3f', test: /node_modules[\\/](@react-three|its-fine|react-use-measure|suspend-react|react-reconciler)[\\/]/, priority: 10 },
          ],
        },
      },
    },
    // three.js is the one big library (about 820 kB minified, 210 kB gzip, in its own chunk).
    chunkSizeWarningLimit: 900,
  },
});
