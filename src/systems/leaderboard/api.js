/**
 * Client for the leaderboard API (Netlify functions in production, a dev
 * middleware in `npm run dev`). Every call resolves to { ok, data?, error? }
 * and never throws, so the UI can degrade gracefully when offline.
 */
async function request(url, options) {
  try {
    const res = await fetch(url, options);
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* non-JSON response, e.g. the API is not deployed */
    }
    if (res.ok && body) return { ok: true, data: body };
    return { ok: false, error: body?.error ?? 'Leaderboard is unavailable right now' };
  } catch {
    return { ok: false, error: 'Could not reach the leaderboard. Check your connection.' };
  }
}

export function fetchBoard(dateKey, playerId) {
  const params = new URLSearchParams({ key: dateKey });
  if (playerId) params.set('playerId', playerId);
  return request(`/api/leaderboard?${params}`);
}

/** Submits a finished daily run: the server replays `inputs` to verify the score. */
export function submitRun({ playerId, name, dailyKey, inputs, claimedScore }) {
  return request('/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, name, dailyKey, inputs, claimedScore }),
  });
}

/** Today and yesterday (UTC), the two boards the server keeps open. */
export function boardDays(todayKey, yesterdayKey) {
  return [
    { key: todayKey, label: 'Today' },
    { key: yesterdayKey, label: 'Yesterday' },
  ];
}
