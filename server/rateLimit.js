import { createHash } from 'node:crypto';

/**
 * Fixed-window rate limiting over the same tiny storage interface as the
 * leaderboard ({ get(key), set(key, value) }).
 *
 * One record per client (and scope) holds { start, count }; a new window
 * overwrites it, so storage stays bounded by the number of distinct clients.
 * Identifiers (IP addresses, player ids) are hashed before they are used as
 * storage keys, so no raw IPs are kept.
 *
 * Limitations: the read-modify-write is not atomic, so a burst of truly
 * simultaneous requests can slip a few extra through; that is fine for
 * abuse prevention but not for exact quotas.
 */
export const LIMITS = Object.freeze({
  /** Score submissions per hour (each one costs a full replay on the server). */
  submitPerIp: { limit: 20, windowMs: 60 * 60 * 1000 },
  submitPerPlayer: { limit: 12, windowMs: 60 * 60 * 1000 },
  /** Leaderboard reads per minute. */
  readPerIp: { limit: 120, windowMs: 60 * 1000 },
});

const hash = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 24);

/**
 * Counts one request against `rule` for `id`. Returns { ok: true } while under the limit,
 * or { ok: false, retryAfter } (whole seconds) once it is exceeded.
 */
export async function hit(store, scope, id, rule, now = new Date()) {
  const key = `rl:${scope}:${hash(id)}`;
  const t = now.getTime();
  const record = await store.get(key);
  const fresh = !record || t - record.start >= rule.windowMs || t < record.start;
  const state = fresh ? { start: t, count: 0 } : record;
  if (state.count >= rule.limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((state.start + rule.windowMs - t) / 1000)) };
  }
  state.count += 1;
  await store.set(key, state);
  return { ok: true };
}

export function tooMany(retryAfter) {
  const minutes = Math.ceil(retryAfter / 60);
  return {
    ok: false,
    status: 429,
    retryAfter,
    error:
      retryAfter > 90
        ? `Too many submissions. Try again in about ${minutes} minutes.`
        : 'Too many requests. Try again in a minute.',
  };
}
