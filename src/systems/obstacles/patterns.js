import { WORLD } from '../physics/constants.js';

/**
 * Obstacle patterns. Each pattern builds one "section" at track position
 * `x` around a safe corridor centred at `center` with height `gap`, using
 * the builder `b` (which allocates from object pools).
 *
 * Every pattern returns:
 *   length: horizontal extent of the section
 *   free:   [minY, maxY] the extremes the bird could be at when leaving it
 *           (used by the spawner to keep the NEXT corridor reachable)
 *   lo/hi:  the guaranteed corridor
 *
 * Builder API (all in track coordinates):
 *   b.column(xCenter, yBottom, yTop, width, cap)  cap: +1 glow on top end, -1 on bottom end
 *   b.block(x0, x1, yBottom, yTop, cap)
 *   b.rock(x, y, radius)
 *   b.orb(x, y)
 */
const BELOW = WORLD.groundY - 1.5; // bases sink below the ground plane
const ABOVE = WORLD.obstacleTopY;

/** Classic gate: a column from the ground and one hanging from above. */
function gate(b, x, center, gap, rng) {
  const w = rng.range(1.2, 1.6);
  const lo = center - gap / 2;
  const hi = center + gap / 2;
  const cx = x + w / 2;
  b.column(cx, BELOW, lo, w, 1);
  b.column(cx, hi, ABOVE, w, -1);
  if (rng.chance(0.55)) b.orb(cx, center);
  return { length: w, lo, hi, free: [lo, hi] };
}

/** A single tall column, from the ground or hanging from above. */
function column(b, x, center, gap, rng) {
  const w = rng.range(1.3, 1.8);
  const cx = x + w / 2;
  const mid = (WORLD.groundY + WORLD.ceilingY) / 2;
  if (center >= mid) {
    const lo = center - gap / 2;
    b.column(cx, BELOW, lo, w, 1);
    if (rng.chance(0.5)) b.orb(cx, lo + 1.1);
    return { length: w, lo, hi: WORLD.ceilingY, free: [lo, WORLD.ceilingY] };
  }
  const hi = center + gap / 2;
  b.column(cx, hi, ABOVE, w, -1);
  if (rng.chance(0.5)) b.orb(cx, hi - 1.1);
  return { length: w, lo: WORLD.groundY, hi, free: [WORLD.groundY + 0.4, hi] };
}

/** One or two big floating rocks blocking one side of the corridor. */
function floatingRocks(b, x, center, gap, rng) {
  const mid = (WORLD.groundY + WORLD.ceilingY) / 2;
  const r = rng.range(0.9, 1.25);
  const lo = center - gap / 2;
  const hi = center + gap / 2;
  // Rock sits just outside the corridor on the side with more room.
  const below = center >= mid;
  const ry = below ? lo - r : hi + r;
  b.rock(x + r, ry, r);
  let length = 2 * r;
  if (rng.chance(0.5)) {
    const r2 = rng.range(0.6, 0.85);
    const ry2 = below ? ry - r - r2 * 0.9 : ry + r + r2 * 0.9;
    b.rock(x + r + rng.range(0.3, 0.9), ry2, r2);
    length = Math.max(length, r + 0.9 + r2 * 2);
  }
  if (rng.chance(0.6)) b.orb(x + r, center);
  // The far side of the rock may also be open, so the bird could exit anywhere.
  return { length, lo, hi, free: [WORLD.groundY + 0.4, WORLD.ceilingY] };
}

/** A wall of stacked rocks with a single gap. */
function formation(b, x, center, gap, rng) {
  const lo = center - gap / 2;
  const hi = center + gap / 2;
  const cx = x + 1.1;
  // Downward from the gap's lower edge to below the ground.
  let y = lo;
  let first = true;
  while (y > WORLD.groundY - 0.5) {
    const r = rng.range(0.7, 1.0);
    const jitter = first ? 0 : rng.range(-0.3, 0.3);
    b.rock(cx + jitter, y - r, r);
    y -= r * 1.4;
    first = false;
  }
  // Upward from the gap's upper edge to above the ceiling.
  y = hi;
  first = true;
  while (y < WORLD.ceilingY + 1.2) {
    const r = rng.range(0.7, 1.0);
    const jitter = first ? 0 : rng.range(-0.3, 0.3);
    b.rock(cx + jitter, y + r, r);
    y += r * 1.4;
    first = false;
  }
  b.orb(cx, center);
  return { length: 2.2, lo, hi, free: [lo, hi] };
}

/** A long, narrow tunnel with a line of orbs through it. */
function passage(b, x, center, gap, rng) {
  const length = rng.range(7, 12);
  const lo = center - gap / 2;
  const hi = center + gap / 2;
  b.block(x, x + length, BELOW, lo, 1);
  b.block(x, x + length, hi, ABOVE, -1);
  for (let ox = 1.5; ox < length - 0.8; ox += 3) b.orb(x + ox, center);
  return { length, lo, hi, free: [lo, hi] };
}

export const PATTERNS = { gate, column, floatingRocks, formation, passage };

/** Corridor height per pattern, shrinking with difficulty t ∈ [0, 1]. */
export function gapFor(type, t, rng) {
  const lerp = (a, z) => a + (z - a) * t;
  switch (type) {
    case 'gate':
      return lerp(4.3, 2.9) + rng.range(0, 0.4);
    case 'passage':
      return Math.max(3.2, lerp(4.0, 3.2)) + rng.range(0, 0.2);
    default:
      return lerp(4.1, 3.0) + rng.range(0, 0.4);
  }
}

/**
 * Where each pattern type first appears (m): the first world opens with gates and columns, then the odd boulder, then wall formations, and the long narrow tunnel (the hardest pattern, and the
 * home of the canyon's arches and ledges) joins in the second half of the world, while its gap is still wide. (They used to unlock within the first 320 m.)
 */
export const UNLOCK = Object.freeze({ floatingRocks: 250, formation: 600, passage: 1000 });

/** Weighted pattern choice; new pattern types unlock with distance. */
export function pickPattern(distance, t, rng, previous) {
  const weights = [
    ['gate', 3],
    ['column', 2],
    ['floatingRocks', distance > UNLOCK.floatingRocks ? 1.6 : 0],
    ['formation', distance > UNLOCK.formation ? 1.2 + t : 0],
    ['passage', distance > UNLOCK.passage && previous !== 'passage' ? 0.7 + t : 0],
  ];
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [type, w] of weights) {
    roll -= w;
    if (roll < 0) return type;
  }
  return 'gate';
}
