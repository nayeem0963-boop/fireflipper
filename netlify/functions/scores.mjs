import { getStore } from '@netlify/blobs';
import { MAX_BODY_BYTES, submitScore } from '../../server/leaderboard.js';

/** POST /api/scores: verifies a daily-challenge run by replaying it, then records the score. */
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const result = await submitScore(blobStore(), body);
  return json(result.ok ? result.data : { error: result.error }, result.status);
};

export const config = { path: '/api/scores' };

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
