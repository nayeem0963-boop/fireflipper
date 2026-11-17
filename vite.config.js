import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createMemoryStore, getBoard, openDays, submitScore, MAX_BODY_BYTES } from './server/leaderboard.js';

/**
 * Serves /api/leaderboard and /api/scores during `npm run dev` / `npm run preview` with an in-memory
 * store, using the same code as the Netlify functions. Scores reset when the server restarts.
 */
function devLeaderboardApi() {
  const store = createMemoryStore();
  const send = (res, status, body) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };
  const handler = async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
      const result = await getBoard(store, url.searchParams.get('key') ?? openDays()[0], {
        playerId: url.searchParams.get('playerId') ?? undefined,
      });
      return send(res, result.status, result.ok ? result.data : { error: result.error });
    }
    if (url.pathname === '/api/scores' && req.method === 'POST') {
      let text = '';
      for await (const chunk of req) {
        text += chunk;
        if (text.length > MAX_BODY_BYTES) return send(res, 413, { error: 'Request too large' });
      }
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        return send(res, 400, { error: 'Invalid JSON' });
      }
      const result = await submitScore(store, body);
      return send(res, result.status, result.ok ? result.data : { error: result.error });
    }
    next();
  };
  return {
    name: 'dev-leaderboard-api',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devLeaderboardApi()],
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
