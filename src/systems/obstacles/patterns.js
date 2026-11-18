import { WORLD } from '../physics/constants.js';
import { RING } from './dynamics.js';
import { firstAppearance, patternWeightsAt } from '../world/environments.js';

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
  // Half the time the columns arrive roughly in step (all low as you pass, so the low route is
  // open); otherwise neighbours are out of step with each other and their gaps open at different times.
  const inStep = rng.chance(0.5);
  let s = inStep ? rng.range(0, 0.3) : rng();
  const rising = rng.chance(0.5);
  for (let i = 0; i < n; i++) {
    const gx = x + 0.6 + i * pitch;
    if (inStep) s = clamp(s + rng.range(-0.06, 0.06), 0, 1);
    else s = clamp(1 - s + rng.range(-0.2, 0.2), 0, 1);
    b.geyser(gx, w, topMin, topMax, period, s, inStep ? rising : rng.chance(0.5), ctx.timeAt(gx));
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
 * Island chain (Floating Islands): three slabs of floating stone, alternately just above and just
 * below the straight line through them. The straight line squeezes between them (orbs and the odd
 * gem sit on it); flying over or under the whole chain is slower but safe.
 */
function islandChain(b, x, center, gap, rng, ctx) {
  const n = 3;
  const pitch = 5.2;
  const amp = lerp(1.05, 1.35, ctx.t);
  let length = 0;
  for (let i = 0; i < n; i++) {
    const hw = rng.range(1.2, 1.7);
    const cx = x + 1.8 + i * pitch;
    const above = i % 2 === 0;
    const y = clamp(center + (above ? amp : -amp), WORLD.groundY + 1.2, WORLD.ceilingY - 0.9);
    // Glow on the face that looks toward the straight line.
    b.block(cx - hw, cx + hw, y - 0.38, y + 0.38, above ? -1 : 1);
    b.orb(cx, center, true); // right on the squeeze line
    length = cx + hw - x;
  }
  if (rng.chance(0.3)) b.gem(x + 1.8 + pitch * 1.5, center);
  return { length: length + 0.4, lo: center - 0.4, hi: center + 0.4, free: [WORLD.groundY + 0.4, WORLD.ceilingY] };
}

/**
 * Grove (Burning Forest): narrow trees close together, alternately hanging from above and rising
 * from below, with the opening between them swinging up and down. A rhythm to settle into.
 */
function grove(b, x, center, gap, rng, ctx) {
  const n = 3;
  const pitch = lerp(3.9, 3.5, ctx.t);
  const w = rng.range(1.0, 1.25);
  const swing = lerp(0.7, 1.1, ctx.t);
  const g = Math.max(3.0, gap - 0.2);
  const minC = WORLD.groundY + g / 2 + 0.5;
  const maxC = WORLD.ceilingY - g / 2 - 0.2;
  let lo = center;
  let hi = center;
  for (let i = 0; i < n; i++) {
    const ci = clamp(center + (i % 2 ? -swing : swing), minC, maxC);
    const cx = x + 0.7 + i * pitch;
    if (i % 2 === 0) b.column(cx, ci + g / 2, ABOVE, w, -1);
    else b.column(cx, BELOW, ci - g / 2, w, 1);
    if (rng.chance(0.55)) b.orb(cx, ci);
    lo = ci - g / 2;
    hi = ci + g / 2;
  }
  return { length: 0.7 * 2 + (n - 1) * pitch + w, lo, hi, free: [WORLD.groundY + 0.4, WORLD.ceilingY] };
}

/**
 * Ashfall (Ash Storm): a volley of small boulders dropping through lanes only ~3 u apart, each
 * reaching a different height as you arrive. Every lane glows before its boulder falls.
 */
function ashfall(b, x, center, gap, rng, ctx) {
  const n = 3;
  const pitch = 3.1;
  for (let i = 0; i < n; i++) {
    const bx = x + 1.0 + i * pitch;
    const yCross = clamp(center + rng.range(-1.5, 1.5), -0.8, 3.0);
    b.boulder(bx, rng.range(0.55, 0.68), yCross, ctx.timeAt(bx));
    if (i === 1) b.orb(bx + 1.5, yCross, true);
  }
  return { length: 2.0 + (n - 1) * pitch + 1.4, lo: center - 0.4, hi: center + 0.4, free: [WORLD.groundY + 0.4, WORLD.ceilingY] };
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

export const PATTERNS = { gate, column, floatingRocks, formation, passage, tunnel, splitGate, geysers, spinner, boulders, islandChain, grove, ashfall };

/** Patterns with moving parts; they get extra spacing and never follow each other. */
export const MOVING = new Set(['geysers', 'spinner', 'boulders', 'ashfall']);

/**
 * Corridor height per pattern, shrinking with difficulty t ∈ [0, 1], and a little further in the
 * late game (`late` ∈ [0, 1] over 1,600 to 3,200 m) so the later environments keep getting harder.
 */
export function gapFor(type, t, rng, late = 0) {
  let g;
  switch (type) {
    case 'gate':
      g = lerp(4.3, 2.9, t) + rng.range(0, 0.4);
      break;
    case 'passage':
      g = Math.max(3.2, lerp(4.0, 3.2, t)) + rng.range(0, 0.2);
      break;
    case 'tunnel':
      g = lerp(3.9, 3.1, t) + rng.range(0, 0.2);
      break;
    case 'splitGate':
      g = lerp(4.2, 3.4, t) + rng.range(0, 0.3);
      break;
    case 'islandChain':
    case 'grove':
      g = lerp(4.0, 3.2, t) + rng.range(0, 0.3);
      break;
    default:
      g = lerp(4.1, 3.0, t) + rng.range(0, 0.4);
  }
  return Math.max(2.7, g - 0.25 * late);
}

/**
 * Distance at which each pattern first appears, derived from the environments' tables: the
 * opening environment introduces things one at a time, later ones introduce their own signature.
 */
export const UNLOCK = Object.freeze(Object.fromEntries(Object.keys(PATTERNS).map((type) => [type, firstAppearance(type)])));

const weights = {};

/**
 * Weighted pattern choice from the current environment's table (blended across a transition, so
 * the mix changes gradually). `late` makes moving hazards a little more common deep into a run.
 */
export function pickPattern(distance, t, rng, previous, late = 0) {
  patternWeightsAt(distance, t, weights);
  const moving = MOVING.has(previous);
  let total = 0;
  for (const type in weights) {
    let w = weights[type];
    if (w <= 0 || !(type in PATTERNS)) {
      weights[type] = 0;
      continue;
    }
    if (MOVING.has(type)) w = moving ? 0 : w * (1 + 0.5 * late);
    if (type === 'splitGate' && previous === 'splitGate') w = 0;
    if ((type === 'passage' || type === 'tunnel') && (previous === 'passage' || previous === 'tunnel')) w = 0;
    weights[type] = w;
    total += w;
  }
  if (total <= 0) return 'gate';
  let roll = rng() * total;
  for (const type in weights) {
    roll -= weights[type];
    if (roll < 0 && weights[type] > 0) return type;
  }
  return 'gate';
}
