import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Keeps Netlify deploy previews and branch deploys out of search results. Netlify sets CONTEXT to 'production', 'deploy-preview' or 'branch-deploy'; for anything but
 * production this build says noindex in the page and ships a robots.txt that disallows everything. Production (and a local build, where CONTEXT is unset) is unchanged.
 * Every copy already points at https://fireflipper.com/ as its canonical URL.
 */
const keepNonProductionOutOfSearch = () => {
  const context = process.env.CONTEXT;
  const hidden = !!context && context !== 'production';
  let outDir = 'dist';
  return {
    name: 'fireflipper-noindex-outside-production',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    transformIndexHtml(html) {
      return hidden ? html.replace(/(<meta name="robots" content=")[^"]*(")/, '$1noindex, nofollow$2') : html;
    },
    closeBundle() {
      if (hidden) writeFileSync(join(outDir, 'robots.txt'), `# ${context}: not for search engines\nUser-agent: *\nDisallow: /\n`);
    },
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), keepNonProductionOutOfSearch()],
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
