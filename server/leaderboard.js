import { seedForKey, todayKey } from '../src/utils/daily.js';
import { replayRun, validateLog } from '../src/systems/replay/replay.js';
import { SIM_VERSION } from '../src/systems/game/simVersion.js';
import { validateName } from './moderation.js';
import { LIMITS, hit, tooMany } from './rateLimit.js';

/**
 * Leaderboard core: validation, replay verification and ranking. Pure
 * JavaScript over a tiny storage interface ({ get(key), set(key, value) }),
 * so the same code runs in the Netlify functions, the dev server and the
 * tests.
 *
 * Scope: the daily challenge only. Everyone plays the same date-seeded
 * track, so scores are comparable, and the seed cannot be ground offline
 * to find an easy track. Free-play runs use client-chosen seeds and would
 * need server-issued seeds before they could have a fair board.
 */
export const BOARD_SIZE = 100;
export const DEFAULT_LIMIT = 25;
export const MAX_BODY_BYTES = 256 * 1024;
const KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

// Boards are per date AND per rules version, so runs played under different rules never share a ranking.
const boardKey = (dateKey) => `daily:${dateKey}:v${SIM_VERSION}`;
const DAY_MS = 86400000;

/** Dates whose boards accept scores and can be shown: today and yesterday (UTC). */
export function openDays(now = new Date()) {
  return [todayKey(now), todayKey(new Date(now.getTime() - DAY_MS))];
}

const fail = (status, error) => ({ ok: false, status, error });

/**
 * Verifies and records a score. The score comes from replaying the
 * submitted inputs, never from the client's claim.
 *
 * `clientId` identifies the caller (the functions pass the request IP). Rate limits are checked
 * before the expensive replay: first per client, then per player id.
 */
export async function submitScore(store, body, now = new Date(), { clientId } = {}) {
  if (clientId) {
    const ip = await hit(store, 'submit-ip', clientId, LIMITS.submitPerIp, now);
    if (!ip.ok) return tooMany(ip.retryAfter);
  }
  if (!body || typeof body !== 'object') return fail(400, 'Invalid request');
  if (typeof body.playerId !== 'string' || !ID_PATTERN.test(body.playerId))
    return fail(400, 'Invalid player id');
  const player = await hit(store, 'submit-player', body.playerId, LIMITS.submitPerPlayer, now);
  if (!player.ok) return tooMany(player.retryAfter);
  const checked = validateName(body.name);
  if (!checked.ok) return fail(400, checked.error);
  const name = checked.name;
  if (body.simVersion !== SIM_VERSION) {
    return {
      ok: false,
      status: 409,
      code: 'outdated',
      error: 'The game was updated. Reload the page to submit your score.',
    };
  }
  if (typeof body.dailyKey !== 'string' || !KEY_PATTERN.test(body.dailyKey)) return fail(400, 'Invalid date');
  if (!openDays(now).includes(body.dailyKey)) return fail(400, 'That daily challenge is closed');
  const logError = validateLog(body.inputs);
  if (logError) return fail(400, logError);

  const result = replayRun(seedForKey(body.dailyKey), body.inputs);
  if (!result.finished) return fail(422, 'Run did not finish');
  if (body.claimedScore !== undefined && body.claimedScore !== result.score) {
    return fail(422, 'Score could not be verified');
  }

  const key = boardKey(body.dailyKey);
  const board = (await store.get(key)) ?? { entries: [] };
  const existing = board.entries.find((e) => e.playerId === body.playerId);
  let improved = false;
  if (!existing) {
    board.entries.push({
      playerId: body.playerId,
      name,
      score: result.score,
      distance: result.distance,
      orbs: result.orbs,
      at: now.toISOString(),
    });
    improved = true;
  } else {
    existing.name = name;
    if (result.score > existing.score) {
      Object.assign(existing, {
        score: result.score,
        distance: result.distance,
        orbs: result.orbs,
        at: now.toISOString(),
      });
      improved = true;
    }
  }
  board.entries.sort((a, b) => b.score - a.score || a.at.localeCompare(b.at));
  board.entries.length = Math.min(board.entries.length, BOARD_SIZE);
  await store.set(key, board);

  const index = board.entries.findIndex((e) => e.playerId === body.playerId);
  return {
    ok: true,
    status: 200,
    data: {
      score: result.score,
      improved,
      rank: index === -1 ? null : index + 1,
      onBoard: index !== -1,
    },
  };
}

/** Public view of a board. Player ids are never returned; `you` marks the requester's own row. */
export async function getBoard(
  store,
  dateKey,
  { playerId, limit = DEFAULT_LIMIT, clientId } = {},
  now = new Date(),
) {
  if (clientId) {
    const read = await hit(store, 'read-ip', clientId, LIMITS.readPerIp, now);
    if (!read.ok) return tooMany(read.retryAfter);
  }
  if (typeof dateKey !== 'string' || !openDays(now).includes(dateKey)) return fail(400, 'Unknown board');
  const board = (await store.get(boardKey(dateKey))) ?? { entries: [] };
  const top = board.entries.slice(0, Math.max(1, Math.min(limit, BOARD_SIZE)));
  const meIndex = playerId ? board.entries.findIndex((e) => e.playerId === playerId) : -1;
  return {
    ok: true,
    status: 200,
    data: {
      key: dateKey,
      simVersion: SIM_VERSION,
      total: board.entries.length,
      entries: top.map((e, i) => ({
        rank: i + 1,
        name: e.name,
        score: e.score,
        distance: e.distance,
        orbs: e.orbs,
        you: meIndex === i,
      })),
      me: meIndex === -1 ? null : { rank: meIndex + 1, score: board.entries[meIndex].score },
    },
  };
}

/** In-memory storage for tests and the dev server. */
export function createMemoryStore() {
  const map = new Map();
  return {
    async get(key) {
      const v = map.get(key);
      return v === undefined ? null : JSON.parse(v);
    },
    async set(key, value) {
      map.set(key, JSON.stringify(value));
    },
  };
}
