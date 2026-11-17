import { PHYSICS, WORLD } from '../physics/constants.js';
import { GEYSER_MIN_PERIOD } from './dynamics.js';
import { biomeIdAt } from '../biomes/biomes.js';

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
 *   b.swingGate(xCenter, width, center, gap, amp, freq, phase)  moving opening
 *   b.geyser(xCenter, width, maxHeight, period, phaseSeconds)    periodic eruption from the ground
 *   b.rockfall(xCenter, radius, y0, drop, triggerDistance)       rock that falls as the bird approaches
 *   b.spinner(xCenter, yCenter, halfLength, halfThickness, omega, phase)  rotating blade (Obsidian Reach)
 *   b.scanner(x0, x1, y, amp, freq, phase)                       sweeping beam (Obsidian Reach)
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

/** Largest swing of a moving gate's opening (units). Used by the spawner to keep the whole swing in the band. */
export const SWING_AMP_MAX = 0.8;
/** Swing size: keeps the always-open lane at least ~2.5 units wide, the same room a plain late-game gate gives. */
const swingAmp = (gap) => Math.min(SWING_AMP_MAX, Math.max(0.2, (gap - 2.5) / 2));
export const swingExtent = (gap) => swingAmp(gap);

/**
 * A gate whose opening swings up and down. The bird can always fly the lane that stays open through the
 * whole swing (`lo..hi` below), so no timing is required, but timing the widest moment gives more room.
 */
function swingGate(b, x, center, gap, rng) {
  const w = rng.range(1.2, 1.5);
  const amp = swingAmp(gap);
  const cx = x + w / 2;
  b.swingGate(cx, w, center, gap, amp, rng.range(0.3, 0.42), rng.range(0, Math.PI * 2));
  if (rng.chance(0.5)) b.orb(cx, center);
  return {
    length: w,
    // The lane open at every moment of the swing.
    lo: center + amp - gap / 2,
    hi: center - amp + gap / 2,
    // After the gate the bird may be anywhere the opening has been.
    free: [center - amp - gap / 2, center + amp + gap / 2],
  };
}

/**
 * Lava vents on the ground that erupt on a cycle (with a telegraphed glow first). The space above the
 * eruption height is always safe; low orbs tempt the player to time the gaps between eruptions.
 */
function geyser(b, x, center, gap, rng) {
  const top = center - gap / 2; // the eruption stops short of the corridor
  const maxH = top - WORLD.groundY;
  // Too little room for a visible eruption: fall back to a plain column.
  if (maxH < 1.4) return column(b, x, center, gap, rng);
  const w = rng.range(1.3, 1.6);
  const spacing = w + 2.2;
  const period = rng.range(GEYSER_MIN_PERIOD, GEYSER_MIN_PERIOD + 1.0);
  const count = rng.chance(0.5) ? 2 : 1;
  const start = rng.range(0, period);
  for (let i = 0; i < count; i++) {
    const cx = x + w / 2 + i * spacing;
    // Alternate vents are half a cycle apart, so one is usually quiet.
    b.geyser(cx, w, maxH, period, start + (i * period) / 2);
    b.orb(cx, WORLD.groundY + 1.1);
  }
  const length = w + (count - 1) * spacing;
  return { length, lo: top, hi: WORLD.ceilingY, free: [top, WORLD.ceilingY] };
}

/** Distance from the rock at which it starts to fall (units). About 1.5 s of warning at cruising speed. */
export const ROCKFALL_TRIGGER = 13;

/**
 * Rocks that drop from above as the bird approaches. The fall is tied to the bird's distance, so the rock is at a
 * known height when the bird crosses it, and the lane below it is guaranteed clear: the rock's lowest point during
 * the crossing stays above the lane. Anything higher is the risky route. (A bird high enough to be above the rock
 * by then is also safe, but that sliver is not relied on.)
 */
function rockfall(b, x, center, gap, rng) {
  const r = rng.range(0.8, 1.05);
  const cr = r * 0.86;
  const laneTop = center + gap / 2;
  // Lowest height the rock may reach before the bird has fully crossed it.
  const yExit = laneTop + cr + PHYSICS.birdRadius + 0.15;
  // No room for a rock above this lane: fall back to a plain column.
  if (yExit > WORLD.ceilingY - 0.3) return column(b, x, center, gap, rng);

  const y0 = Math.max(WORLD.ceilingY + 1.7, yExit + 2.2);
  const pExit = 1 + (cr + PHYSICS.birdRadius) / ROCKFALL_TRIGGER; // progress when the bird has just cleared it
  const drop = (y0 - yExit) / (pExit * pExit);
  const cx = x + r;
  b.rockfall(cx, r, y0, drop, ROCKFALL_TRIGGER);
  if (rng.chance(0.6)) b.orb(cx, center);
  return {
    length: 2 * r,
    lo: WORLD.groundY + 0.4,
    hi: laneTop,
    // The bird may have taken the lane or the riskier way over the top: assume anywhere.
    free: [WORLD.groundY + 0.4, WORLD.ceilingY],
  };
}

const MID = (WORLD.groundY + WORLD.ceilingY) / 2;

/**
 * Where to put a hazard that sweeps a region of height `reach` (its half-height, including the bird's radius and
 * a margin) so the corridor lane stays clear: above the lane when the lane is in the lower half, below it
 * otherwise. Returns null when it would not fit in the playable band.
 */
function placeBeside(center, gap, reach) {
  const laneTop = center + gap / 2;
  const laneBottom = center - gap / 2;
  const above = center < MID;
  const cy = above ? laneTop + reach : laneBottom - reach;
  // Sweeping past the ceiling or into the lava is fine (the bird can't go there); beyond that it can't be seen.
  if ((above && cy > WORLD.ceilingY + 1.0) || (!above && cy < WORLD.groundY - 0.4)) return null;
  return {
    cy,
    lane: above ? { lo: WORLD.groundY + 0.4, hi: laneTop } : { lo: laneBottom, hi: WORLD.ceilingY },
  };
}

/**
 * Obsidian Reach: a crystal blade spinning around a pivot. The disc it sweeps never reaches the lane, so
 * no timing is needed to stay safe; orbs on the blade's path tempt a timed grab.
 */
function spinner(b, x, center, gap, rng) {
  const hl = rng.range(1.5, 1.9);
  const hw = 0.16;
  const spot = placeBeside(center, gap, hl + hw + PHYSICS.birdRadius + 0.15);
  if (!spot) return column(b, x, center, gap, rng);
  const cx = x + hl + hw;
  const omega = rng.range(0.9, 1.5) * (rng.chance(0.5) ? 1 : -1);
  b.spinner(cx, spot.cy, hl, hw, omega, rng.range(0, Math.PI * 2));
  if (rng.chance(0.7)) {
    b.orb(cx - hl * 0.6, spot.cy);
    b.orb(cx + hl * 0.6, spot.cy);
  }
  return {
    length: 2 * (hl + hw),
    lo: spot.lane.lo,
    hi: spot.lane.hi,
    free: [WORLD.groundY + 0.4, WORLD.ceilingY],
  };
}

/**
 * Obsidian Reach: a beam that sweeps up and down across a stretch of the track. It never comes into the lane
 * (which sits beside its sweep), but the orbs along it reward flying in its path at the right moment.
 */
function scanner(b, x, center, gap, rng) {
  const length = rng.range(8, 10);
  const amp = rng.range(0.7, 1.2);
  const spot = placeBeside(center, gap, amp + 0.11 + PHYSICS.birdRadius + 0.15);
  if (!spot) return column(b, x, center, gap, rng);
  b.scanner(x, x + length, spot.cy, amp, rng.range(0.28, 0.4), rng.range(0, Math.PI * 2));
  b.orb(x + length * 0.35, spot.cy);
  b.orb(x + length * 0.65, spot.cy);
  return { length, lo: spot.lane.lo, hi: spot.lane.hi, free: [WORLD.groundY + 0.4, WORLD.ceilingY] };
}

export const PATTERNS = {
  gate,
  column,
  floatingRocks,
  formation,
  passage,
  swingGate,
  geyser,
  rockfall,
  spinner,
  scanner,
};

/** Corridor height per pattern, shrinking with difficulty t ∈ [0, 1]. */
export function gapFor(type, t, rng) {
  const lerp = (a, z) => a + (z - a) * t;
  switch (type) {
    case 'gate':
      return lerp(4.3, 2.9) + rng.range(0, 0.4);
    case 'swingGate':
      // A little wider than a plain gate, since the opening is moving.
      return lerp(4.8, 3.4) + rng.range(0, 0.4);
    case 'passage':
      return Math.max(3.2, lerp(4.0, 3.2)) + rng.range(0, 0.2);
    default:
      return lerp(4.1, 3.0) + rng.range(0, 0.4);
  }
}

/** Weighted pattern choice; new pattern types unlock with distance. */
export function pickPattern(distance, t, rng, previous) {
  // Each biome has its own hazards: lava geysers belong to Ember Valley, crystal blades and sweeping beams to
  // Obsidian Reach. (The scenery blends over 500-700 m; the hazards switch at the midpoint.)
  const obsidian = biomeIdAt(distance) === 'obsidian';
  const weights = [
    ['gate', 3],
    ['column', 2],
    ['swingGate', distance > 150 ? 1.2 + t : 0],
    ['floatingRocks', distance > 80 ? 1.6 : 0],
    ['geyser', !obsidian && distance > 260 ? 1.0 + t : 0],
    ['spinner', obsidian ? 1.3 + t : 0],
    ['scanner', obsidian ? 1.1 + t : 0],
    ['rockfall', distance > 200 ? 1.0 + t : 0],
    ['formation', distance > 180 ? 1.2 + t : 0],
    ['passage', distance > 320 && previous !== 'passage' ? 0.7 + t : 0],
  ];
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [type, w] of weights) {
    roll -= w;
    if (roll < 0) return type;
  }
  return 'gate';
}
