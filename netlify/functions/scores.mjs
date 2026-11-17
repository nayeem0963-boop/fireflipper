import { getStore } from '@netlify/blobs';
import { MAX_BODY_BYTES, submitScore } from '../../server/leaderboard.js';

/** POST /api/scores: verifies a daily-challenge run by replaying it, then records the score. */
export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const result = await submitScore(blobStore(), body, new Date(), { clientId: clientIp(req, context) });
  return json(result.ok ? result.data : { error: result.error }, result.status, result.retryAfter);
};

export const config = { path: '/api/scores' };

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
