import { WORLD } from '../physics/constants.js';
import { RING } from './dynamics.js';

/**
 * Obstacle patterns. Each pattern builds one "section" at track position
 * `x` around a safe corridor centred at `center` with height `gap`, using
 * the builder `b` (which allocates from object pools).
 *
 * Every pattern returns:
 *   length: horizontal extent of the section (all its obstacles lie inside it)
 *   lo/hi:  the corridor the generator aimed for
 *   free:   rough exit range (legacy; the route planner computes the real one)
 *
 * Patterns only PROPOSE a layout. The spawner runs every proposal through the
 * route planner and discards any that leaves no way through, so a pattern may
 * be bold but can never ship an unavoidable combination.
 *
 * Builder API (all in track coordinates):
 *   b.column(xCenter, yBottom, yTop, width, cap)  cap: +1 glow on top end, -1 on bottom end
 *   b.block(x0, x1, yBottom, yTop, cap)
 *   b.rock(x, y, radius)
 *   b.orb(x, y, risky)       fire orb; `risky` marks orbs that need a dangerous line (for balance stats)
 *   b.gem(x, y)              rare gem (25 pts)
 *   b.geyser(x, w, topMin, topMax, period, sArrive, rising, tArrive)
 *   b.boulder(x, r, yCross, tArrive)
 *   b.spinner(x, y, omega, angleArrive, tArrive)
 *   b.ring(x, y)             optional fire ring (bonus when flown through)
 *
 * ctx = { t: difficulty 0..1, timeAt(x): run time the bird reaches x }
 */
const BELOW = WORLD.groundY - 1.5; // bases sink below the ground plane
const ABOVE = WORLD.obstacleTopY;
const lerp = (a, z, t) => a + (z - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

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

/**
 * Winding tunnel: precision flying. The corridor steps up and down in short
 * segments (never more than ~0.7 per step), so the bird has to keep adjusting.
 */
function tunnel(b, x, center, gap, rng) {
  const segs = 4 + Math.floor(rng() * 2);
  const segLen = 2.4;
  let c = center;
  let lo = c - gap / 2;
  let hi = c + gap / 2;
  const minC = WORLD.groundY + gap / 2 + 0.5;
  const maxC = WORLD.ceilingY - gap / 2 - 0.2;
  for (let i = 0; i < segs; i++) {
    if (i > 0) c = clamp(c + rng.range(-0.7, 0.7), Math.max(minC, center - 1.2), Math.min(maxC, center + 1.2));
    lo = c - gap / 2;
    hi = c + gap / 2;
    const x0 = x + i * segLen;
    b.block(x0, x0 + segLen, BELOW, lo, 1);
    b.block(x0, x0 + segLen, hi, ABOVE, -1);
    b.orb(x0 + segLen / 2, c);
  }
  return { length: segs * segLen, lo, hi, free: [lo, hi] };
}

/**
 * Split gate: a wall with TWO openings. The wide one is the safe route and
 * holds at most one orb. The narrow one, set just above or below it, is the
 * risky route: a line of orbs and, sometimes, a rare gem.
 */
function splitGate(b, x, requested, gap, rng, ctx) {
  const w = rng.range(1.3, 1.6);
  const cx = x + w / 2;
  const sep = rng.range(0.9, 1.1);
  const gh = lerp(2.4, 2.05, ctx.t) + rng.range(0, 0.1);
  const safeGap = clamp(gap, 3.0, 3.4);
  // Both openings plus the pillar between them must fit in the flight band, so the
  // safe opening has to sit low (risky one above) or high (risky one below).
  const maxCenterAbove = WORLD.ceilingY - 0.3 - sep - gh - safeGap / 2;
  const minCenterBelow = WORLD.groundY + 0.45 + sep + gh + safeGap / 2;
  let above;
  if (requested <= maxCenterAbove) above = requested >= minCenterBelow ? rng.chance(0.5) : true;
  else if (requested >= minCenterBelow) above = false;
  else above = requested - maxCenterAbove < minCenterBelow - requested; // nearer feasible side
  // Nudge toward the feasible side; the route planner still checks it can be reached.
  const center = above ? Math.min(requested, maxCenterAbove) : Math.max(requested, minCenterBelow);
  gap = safeGap;
  const lo = center - gap / 2;
  const hi = center + gap / 2;

  // Hard-gap bounds.
  const hLo = above ? hi + sep : lo - sep - gh;
  const hHi = hLo + gh;
  const yh = (hLo + hHi) / 2;

  if (above) {
    b.column(cx, BELOW, lo, w, 1); // under the safe gap
    b.column(cx, hi, hi + sep / 2, w, -1); // separator, glowing toward the safe gap...
    b.column(cx, hi + sep / 2, hHi - gh, w, 1); // ...and toward the hard gap
    b.column(cx, hHi, ABOVE, w, -1); // over the hard gap
  } else {
    b.column(cx, BELOW, hLo, w, 1); // under the hard gap
    b.column(cx, hHi, hHi + sep / 2, w, -1);
    b.column(cx, hHi + sep / 2, lo, w, 1);
    b.column(cx, hi, ABOVE, w, -1); // over the safe gap
  }

  if (rng.chance(0.4)) b.orb(cx, center); // safe route: small reward
  // Risky route: a line of orbs, with a gem at the heart of it now and then.
  b.orb(cx - 2.2, yh, true);
  b.orb(cx - 1.1, yh, true);
  b.orb(cx + 1.1, yh, true);
  b.orb(cx + 2.2, yh, true);
  if (rng.chance(0.45)) b.gem(cx, yh);
  else b.orb(cx, yh, true);
  return { length: w, lo, hi, free: [Math.min(lo, hLo), Math.max(hi, hHi)] };
}

/**
 * Lava columns: geysers that rise and fall on a steady beat. Fly high above
 * the tallest one for the safe route, or time the low route between them for
 * orbs (and sometimes a gem).
 */
function geysers(b, x, center, gap, rng, ctx) {
  const n = ctx.t < 0.4 ? 2 : 3;
  const pitch = 3.4;
  const w = 1.1;
  const topMin = WORLD.groundY + 0.45;
  const topMax = lerp(-0.2, 1.5, ctx.t) + rng.range(0, 0.4);
  const period = lerp(2.5, 1.9, ctx.t) + rng.range(-0.1, 0.1);
  let s = rng();
  for (let i = 0; i < n; i++) {
    const gx = x + 0.6 + i * pitch;
    // Neighbours are out of step with each other, so the gaps open at different times.
    s = clamp(1 - s + rng.range(-0.2, 0.2), 0, 1);
    b.geyser(gx, w, topMin, topMax, period, s, rng.chance(0.5), ctx.timeAt(gx));
  }
  // Low route: orbs just above the vents.
  for (let i = 0; i < n - 1; i++) {
    const ox = x + 0.6 + i * pitch + pitch / 2;
    b.orb(ox, topMin + 1.05, true);
    b.orb(ox, topMin + 1.05 + 0.9, true);
  }
  if (rng.chance(0.3)) b.gem(x + 0.6 + (n - 2) * pitch + pitch / 2, topMin + 1.5);
  // High route: one orb on the safe line.
  if (topMax + 1.8 < WORLD.ceilingY - 0.3) b.orb(x + 0.6 + pitch, topMax + 1.8);
  const length = 0.6 + (n - 1) * pitch + w + 0.6;
  return { length, lo: topMax + 0.8, hi: WORLD.ceilingY, free: [WORLD.groundY + 0.4, WORLD.ceilingY] };
}

/**
 * Spinner: a bar turning at a steady rate in open air. Go over or under it,
 * or thread the orbs at its height by timing the swing.
 */
function spinner(b, x, center, gap, rng, ctx) {
  const px = x + 1.9;
  const py = clamp(center, -1.3, 2.2);
  const omega = (rng.chance(0.5) ? 1 : -1) * lerp(1.15, 1.8, ctx.t);
  b.spinner(px, py, omega, rng() * Math.PI, ctx.timeAt(px));
  // Risky orbs at the spinner's height, either side of it.
  b.orb(px - 2.3, py, true);
  b.orb(px + 2.3, py, true);
  if (rng.chance(0.3)) b.gem(px + 3.0, py);
  return { length: 4.2, lo: py - 0.4, hi: py + 0.4, free: [WORLD.groundY + 0.4, WORLD.ceilingY] };
}

/**
 * Falling boulders: a warning lane glows, then a boulder drops through it and
 * reaches height `yCross` just as the bird does. Be well above or below that
 * height at the moment of crossing.
 */
function boulders(b, x, center, gap, rng, ctx) {
  const n = ctx.t < 0.5 ? 1 : 2;
  const pitch = 4.2;
  for (let i = 0; i < n; i++) {
    const bx = x + 1.2 + i * pitch;
    const yCross = clamp(center + rng.range(-1.2, 1.2), -0.8, 3.0);
    b.boulder(bx, rng.range(0.8, 0.9), yCross, ctx.timeAt(bx));
    // Risky orb in the lane, just behind where the boulder crosses.
    b.orb(bx + 1.7, yCross, true);
  }
  return { length: 2.4 + (n - 1) * pitch, lo: center - 0.4, hi: center + 0.4, free: [WORLD.groundY + 0.4, WORLD.ceilingY] };
}

/**
 * Optional fire ring in open space. Flying through the middle pays a bonus;
 * flying around it costs nothing. The route planner keeps a way around open.
 */
export function fireRing(b, x, yc, rng) {
  b.ring(x, yc);
  b.orb(x, yc, true);
  if (rng.chance(0.25)) b.gem(x, yc);
  return { halfWidth: RING.radius + RING.nodeRadius };
}

export const PATTERNS = { gate, column, floatingRocks, formation, passage, tunnel, splitGate, geysers, spinner, boulders };

/** Patterns with moving parts; they get extra spacing and never follow each other. */
export const MOVING = new Set(['geysers', 'spinner', 'boulders']);

/** Corridor height per pattern, shrinking with difficulty t ∈ [0, 1]. */
export function gapFor(type, t, rng) {
  switch (type) {
    case 'gate':
      return lerp(4.3, 2.9, t) + rng.range(0, 0.4);
    case 'passage':
      return Math.max(3.2, lerp(4.0, 3.2, t)) + rng.range(0, 0.2);
    case 'tunnel':
      return lerp(3.9, 3.1, t) + rng.range(0, 0.2);
    case 'splitGate':
      return lerp(4.2, 3.4, t) + rng.range(0, 0.3);
    default:
      return lerp(4.1, 3.0, t) + rng.range(0, 0.4);
  }
}

/** Distance at which each pattern first appears: new challenges arrive one at a time. */
export const UNLOCK = Object.freeze({
  gate: 0,
  column: 0,
  floatingRocks: 80,
  splitGate: 150,
  formation: 200,
  geysers: 280,
  passage: 320,
  tunnel: 380,
  spinner: 460,
  boulders: 560,
});

/** Weighted pattern choice; new pattern types unlock with distance. */
export function pickPattern(distance, t, rng, previous) {
  const open = (type) => distance > UNLOCK[type];
  const moving = MOVING.has(previous);
  const weights = [
    ['gate', 3 - t],
    ['column', 2 - t * 0.5],
    ['floatingRocks', open('floatingRocks') ? 1.6 : 0],
    ['splitGate', open('splitGate') && previous !== 'splitGate' ? 1.0 + t * 0.8 : 0],
    ['formation', open('formation') ? 1.2 + t : 0],
    ['geysers', open('geysers') && !moving ? 0.8 + 0.9 * t : 0],
    ['passage', open('passage') && previous !== 'passage' && previous !== 'tunnel' ? 0.6 + t * 0.8 : 0],
    ['tunnel', open('tunnel') && previous !== 'passage' && previous !== 'tunnel' ? 0.6 + t : 0],
    ['spinner', open('spinner') && !moving ? 0.7 + 0.9 * t : 0],
    ['boulders', open('boulders') && !moving ? 0.6 + 0.9 * t : 0],
  ];
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [type, w] of weights) {
    roll -= w;
    if (roll < 0) return type;
  }
  return 'gate';
}
