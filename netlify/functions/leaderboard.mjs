import { getStore } from '@netlify/blobs';
import { getBoard, openDays } from '../../server/leaderboard.js';

/** GET /api/leaderboard?key=YYYY-MM-DD[&playerId=...]  ->  top scores for that day's challenge. */
export default async (req, context) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const url = new URL(req.url);
  const key = url.searchParams.get('key') ?? openDays()[0];
  const playerId = url.searchParams.get('playerId') ?? undefined;
  const result = await getBoard(blobStore(), key, { playerId, clientId: clientIp(req, context) });
  return json(result.ok ? result.data : { error: result.error }, result.status, result.retryAfter);
};

export const config = { path: '/api/leaderboard' };

function blobStore() {
  const store = getStore('leaderboards');
  return {
    get: (k) => store.get(k, { type: 'json' }),
    set: (k, v) => store.setJSON(k, v),
  };
}

/** The caller's IP as seen by Netlify (used only as a hashed rate-limit key). */
function clientIp(req, context) {
  return context?.ip ?? req.headers.get('x-nf-client-connection-ip') ?? undefined;
}

function json(body, status = 200, retryAfter) {
  const headers = { 'Cache-Control': 'no-store' };
  if (retryAfter) headers['Retry-After'] = String(retryAfter);
  return Response.json(body, { status, headers });
}
