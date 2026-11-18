import { WORLD } from '../physics/constants.js';
import { MOVING, PATTERNS, fireRing, gapFor, pickPattern } from './patterns.js';
import { CELLS, MAX_DROP_RATE, MAX_RISE_RATE, MOVING_MARGIN, ROUTE_MARGIN, SIGHT_DISTANCE, cellOf, createPlanner, hullOf } from './planner.js';
import { speedAt, timeAtDistance } from './dynamics.js';

/**
 * Procedural track generation.
 *
 * Fairness guarantee: every section is proposed by a pattern and then checked
 * by the route planner (planner.js) against the exact times the bird will
 * arrive. A section ships only if, from every height the bird could be at
 * when entering it, some route threads all of its hazards. Otherwise it is
 * rolled back and re-drawn, and after repeated rejections a plain gate with
 * extra room replaces it. The headless tests (npm run test:sim) re-verify
 * this over thousands of metres of generated track.
 */
export { MAX_RISE_RATE, MAX_DROP_RATE, speedAt };

/** Distance before a section that the player needs to settle into its corridor. */
const SETTLE_DISTANCE = 2.5;
/** Minimum run-in before a moving hazard, so its first move is visible and readable. */
const MOVING_MIN_SPACING = 10.5;
/** Extra breathing room after a moving hazard. */
const BREATHER = 1.2;
/** Fire rings need this much open space around them. */
const RING_SPACING = 11;
const MAX_ATTEMPTS = 6;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Difficulty 0..1 as a function of distance travelled. */
export function difficultyAt(distance) {
  return clamp((distance - 40) / 1600, 0, 1);
}

export function createTrack() {
  return {
    nextX: 0,
    /** Heights the bird can occupy at `reachX` (a Uint8Array over the planner grid). */
    reach: new Uint8Array(CELLS),
    reachNext: new Uint8Array(CELLS),
    anywhere: new Uint8Array(CELLS).fill(1),
    scratch: new Uint8Array(CELLS),
    reachX: 0,
    free: [0, 0],
    center: 0,
    previous: null,
    corridors: [],
    planner: createPlanner(),
    stats: { sections: 0, rejected: 0, sightRejected: 0, fallbacks: 0, unverified: 0, rings: 0, types: {} },
  };
}

export function resetTrack(track, startY) {
  track.nextX = WORLD.runway;
  track.reach.fill(0);
  track.reach[cellOf(startY)] = 1;
  track.reachX = 0;
  track.free[0] = track.free[1] = startY;
  track.center = startY;
  track.previous = null;
  track.corridors.length = 0;
  const s = track.stats;
  s.sections = s.rejected = s.sightRejected = s.fallbacks = s.unverified = s.rings = 0;
  s.types = {};
}

/** Generate sections until the track extends `spawnAhead` past `distance`. */
export function fillTrack(track, builder, distance, rng) {
  while (track.nextX < distance + WORLD.spawnAhead) generateSection(track, builder, rng);
  // Drop corridors well behind the bird.
  while (track.corridors.length && track.corridors[0].x1 < distance - WORLD.despawnBehind) {
    track.corridors.shift();
  }
}

function generateSection(track, builder, rng) {
  const t = difficultyAt(track.nextX);
  const ctx = { t, timeAt: timeAtDistance };
  const planned = pickPattern(track.nextX, t, rng, track.previous);
  const afterMoving = MOVING.has(track.previous);

  for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
    const lastResort = attempt === MAX_ATTEMPTS;
    // Early rejections re-draw the same pattern; later ones fall back to a roomy gate.
    const type = attempt < 2 ? planned : 'gate';
    const easier = attempt >= 2 ? attempt - 1 : 0;
    const gap = gapFor(type, t, rng) + 0.3 * easier;
    let wantRing = !lastResort && attempt < 2 && track.nextX > 120 && !MOVING.has(type) && rng.chance(0.2 + 0.1 * t);

    let spacing = 12 + (7.5 - 12) * t + rng.range(0, 2.5);
    if (MOVING.has(type)) spacing = Math.max(spacing, MOVING_MIN_SPACING + rng.range(0, 1));
    if (wantRing) spacing = Math.max(spacing, RING_SPACING);
    if (afterMoving) spacing += BREATHER;
    spacing += 1.5 * easier;

    const x = track.nextX + spacing;
    const time = Math.max(0.25, (x - SETTLE_DISTANCE - track.reachX) / speedAt(track.reachX));

    // Aim the corridor where the bird can get to from anywhere it may be.
    const hull = hullOf(track.reach) ?? [WORLD.birdStartY, WORLD.birdStartY];
    const minC = WORLD.groundY + gap / 2 + 0.5;
    const maxC = WORLD.ceilingY - gap / 2 - 0.2;
    let lo = Math.max(minC, hull[1] - MAX_DROP_RATE * time);
    let hi = Math.min(maxC, hull[0] + MAX_RISE_RATE * time);
    if (lo > hi) lo = hi = clamp((lo + hi) / 2, minC, maxC);
    const center = rng.range(lo, hi);

    builder.begin();
    // Sometimes leave a trail of orbs through the open space before the section.
    if (rng.chance(0.3)) {
      const prev = track.center;
      for (let i = 1; i <= 3; i++) {
        const k = i / 4;
        builder.orb(track.nextX + spacing * k, prev + (center - prev) * k);
      }
    }
    const section = PATTERNS[type](builder, x, center, gap, rng, ctx);
    const xEnd = x + section.length + 0.8;

    const mark = builder.mark();
    if (wantRing) {
      const mid = (track.center + center) / 2;
      const room = (v) => clamp(v, WORLD.groundY + 1.5, WORLD.ceilingY - 1.0);
      const up = room(mid + 2.3);
      const down = room(mid - 2.3);
      fireRing(builder, track.nextX + spacing / 2, Math.abs(up - mid) >= Math.abs(down - mid) ? up : down, rng);
    }

    const margin = MOVING.has(type) ? MOVING_MARGIN : ROUTE_MARGIN;
    const check = () => track.planner.validate(track.reach, track.reachX, xEnd, builder.built.obs, track.reachNext, margin);
    // A moving hazard must also be avoidable from ANY height with only SIGHT_DISTANCE of warning.
    const seen = () => {
      if (!MOVING.has(type)) return true;
      let first = Infinity;
      for (const o of builder.built.obs) if (o.dyn) first = Math.min(first, o.x - o.extent);
      const from = Math.max(track.reachX, first - SIGHT_DISTANCE);
      const good = track.planner.validate(track.anywhere, from, xEnd, builder.built.obs, track.scratch, margin);
      if (!good) track.stats.sightRejected++;
      return good;
    };
    let ok = lastResort || (check() && seen());
    if (!ok && wantRing) {
      // The ring is optional: drop it and see whether the section alone is fine.
      builder.rollbackTo(mark);
      wantRing = false;
      ok = check() && seen();
    }
    if (!ok) {
      builder.rollback();
      track.stats.rejected++;
      continue;
    }

    if (lastResort) {
      // Should never happen: keep the track going but make it visible to tests.
      track.stats.unverified++;
      track.reachNext.fill(1);
    }
    if (type !== planned) track.stats.fallbacks++;
    commit(track, type, section, x, center, xEnd, wantRing);
    return;
  }
}

function commit(track, type, section, x, center, xEnd, hadRing) {
  track.reach.set(track.reachNext);
  track.reachX = xEnd;
  const hull = hullOf(track.reach);
  if (hull) {
    track.free[0] = hull[0];
    track.free[1] = hull[1];
  }
  track.corridors.push({ type, x0: x, x1: x + section.length, lo: section.lo, hi: section.hi, center });
  track.center = center;
  track.previous = type;
  track.nextX = x + section.length;
  const s = track.stats;
  s.sections++;
  s.types[type] = (s.types[type] || 0) + 1;
  if (hadRing) s.rings++;
}
