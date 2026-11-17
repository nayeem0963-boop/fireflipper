import { getStore } from '@netlify/blobs';
import { getBoard, openDays } from '../../server/leaderboard.js';

/** GET /api/leaderboard?key=YYYY-MM-DD[&playerId=...]  ->  top scores for that day's challenge. */
export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const url = new URL(req.url);
  const key = url.searchParams.get('key') ?? openDays()[0];
  const playerId = url.searchParams.get('playerId') ?? undefined;
  const result = await getBoard(blobStore(), key, { playerId });
  return json(result.ok ? result.data : { error: result.error }, result.status);
};

export const config = { path: '/api/leaderboard' };

function blobStore() {
  const store = getStore('leaderboards');
  return {
    get: (k) => store.get(k, { type: 'json' }),
    set: (k, v) => store.setJSON(k, v),
  };
}

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
