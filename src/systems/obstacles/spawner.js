import { POWERUPS, WIND, WORLD } from '../physics/constants.js';
import { PATTERNS, gapFor, pickPattern, swingExtent } from './patterns.js';
import { biomeIdAt } from '../biomes/biomes.js';

/**
 * Procedural track generation.
 *
 * Fairness guarantee: each new corridor's centre is constrained so it is
 * reachable from ANY height the bird could have left the previous section
 * at, given the time available (spacing / speed) and conservative climb and
 * drop rates. The headless autopilot test (npm run test:sim) verifies this.
 */
export const MAX_RISE_RATE = 3.2; // units/s a player can sustain by tapping
export const MAX_DROP_RATE = 4.5; // units/s a player can descend and still recover in time
/** Distance before a section that the player needs to settle into its corridor. */
const SETTLE_DISTANCE = 2.5;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Late-game escalation: starts where the main ramp ends, and eases in over this many metres. */
const LATE_START = 1640;
const LATE_RANGE = 2400;
const LATE_EXTRA_SPEED = 1.0;

/** Rhythm: after a run of hazard sections the track opens into a breather (orbs, no hazards). */
const BREATHER_MIN_DISTANCE = 60;
/** Air currents appear in some breathers once past this distance. */
const WIND_MIN_DISTANCE = 180;
const WIND_CHANCE = 0.5;
const WIND_CHANCE_STORM = 0.75;
const BAND_LOW = WORLD.groundY + 0.4;
const BAND_HIGH = WORLD.ceilingY;

/** Difficulty 0..1 as a function of distance travelled. */
export function difficultyAt(distance) {
  return clamp((distance - 40) / 1600, 0, 1);
}

/**
 * Late-game escalation 0..1: keeps rising after the main ramp (which tops out near 1,640 m), so
 * skilled players keep meeting a tougher track instead of a plateau.
 */
export function escalationAt(distance) {
  return clamp((distance - LATE_START) / LATE_RANGE, 0, 1);
}

export function speedAt(distance) {
  const k = clamp(distance / WORLD.speedRampDistance, 0, 1);
  return WORLD.baseSpeed + (WORLD.maxSpeed - WORLD.baseSpeed) * k + LATE_EXTRA_SPEED * escalationAt(distance);
}

function pickPowerup(rng) {
  const entries = Object.entries(POWERUPS.types);
  let roll = rng() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [type, w] of entries) {
    roll -= w;
    if (roll < 0) return type;
  }
  return entries[0][0];
}

export function createTrack() {
  return { nextX: 0, free: [0, 0], center: 0, previous: null, corridors: [], sinceBreather: 0, cycleLen: 5 };
}

export function resetTrack(track, startY) {
  track.nextX = WORLD.runway;
  track.free[0] = track.free[1] = startY;
  track.center = startY;
  track.previous = null;
  track.corridors.length = 0;
  track.sinceBreather = 0;
  track.cycleLen = 5; // the first stretch is a little longer: players are still settling in
}

/**
 * A breather: an open stretch with an arc of orbs and no hazards, so runs alternate tension and relief.
 * The bird could be anywhere in the band when it ends, so the next corridor is planned from the full band,
 * which the spacing logic already handles for the rock patterns.
 */
function buildBreather(track, builder, rng, t) {
  const length = rng.range(16, 20) - 6 * t;
  const x0 = track.nextX;
  const from = clamp(track.center, BAND_LOW + 0.8, BAND_HIGH - 0.8);
  const toOpen = rng.range(BAND_LOW + 1.2, BAND_HIGH - 0.9);
  // Open stretches are where air currents live: no hazards to collide with while the wind pushes.
  // An updraft carries the bird up toward its orbs; a downdraft makes it work to keep them.
  // Obsidian Reach is stormier: more air currents, and more of them downdrafts.
  const storm = biomeIdAt(x0) === 'obsidian';
  let windKind = null;
  if (x0 > WIND_MIN_DISTANCE && rng.chance(storm ? WIND_CHANCE_STORM : WIND_CHANCE)) {
    windKind = rng.chance(storm ? 0.45 : 0.6) ? 'up' : 'down';
  }
  const to = windKind === 'up' ? BAND_HIGH - 0.9 : windKind === 'down' ? rng.range(0.4, 1.6) : toOpen;
  const wave = rng.range(0.6, 1.3) * (rng.chance(0.5) ? 1 : -1) * (windKind ? 0.4 : 1);
  if (windKind) builder.wind(x0 + 3, x0 + length - 3, windKind === 'up' ? WIND.updraft : WIND.downdraft);
  const count = Math.floor((length - 4) / 2);
  let endY = from;
  for (let i = 0; i < count; i++) {
    const k = (i + 0.5) / count;
    const y = clamp(
      from + (to - from) * k + Math.sin(k * Math.PI * 2) * wave,
      BAND_LOW + 0.5,
      BAND_HIGH - 0.5,
    );
    builder.orb(x0 + 2 + k * (length - 4), y);
    endY = y;
  }
  track.corridors.push({
    type: 'breather',
    x0,
    x1: x0 + length,
    lo: BAND_LOW,
    hi: BAND_HIGH,
    center: (from + to) / 2,
  });
  track.free[0] = BAND_LOW;
  track.free[1] = BAND_HIGH;
  track.center = endY;
  track.previous = 'breather';
  track.nextX = x0 + length;
  track.sinceBreather = 0;
  track.cycleLen = 4 + Math.floor(rng() * 3);
}

/** Generate sections until the track extends `spawnAhead` past `distance`. */
export function fillTrack(track, builder, distance, rng) {
  while (track.nextX < distance + WORLD.spawnAhead) {
    const t = difficultyAt(track.nextX);
    if (track.sinceBreather >= track.cycleLen && track.nextX > BREATHER_MIN_DISTANCE) {
      buildBreather(track, builder, rng, t);
      continue;
    }
    const type = pickPattern(track.nextX, t, rng, track.previous);
    const late = escalationAt(track.nextX);
    const gap = gapFor(type, t, rng) - 0.35 * late;
    // The last two sections before a breather come a little faster: the tension builds, then releases.
    const buildUp = track.sinceBreather >= track.cycleLen - 2 ? 0.88 : 1;
    const spacing = Math.max(6.4, (12 + (7.5 - 12) * t - 0.9 * late + rng.range(0, 2.5)) * buildUp);
    const x = track.nextX + spacing;
    const time = Math.max(0.25, (spacing - SETTLE_DISTANCE) / speedAt(track.nextX));

    // Corridor centre must be in the playable band...
    // A swinging gate's whole swing has to stay inside the band, so allow for it here.
    const room = type === 'swingGate' ? gap + 2 * swingExtent(gap) : gap;
    const minC = WORLD.groundY + room / 2 + 0.5;
    const maxC = WORLD.ceilingY - room / 2 - 0.2;
    // ...and reachable from both extremes of where the bird may be.
    let lo = Math.max(minC, track.free[1] - MAX_DROP_RATE * time);
    let hi = Math.min(maxC, track.free[0] + MAX_RISE_RATE * time);
    if (lo > hi) lo = hi = clamp((lo + hi) / 2, minC, maxC);
    const center = rng.range(lo, hi);

    // Sometimes leave a trail of orbs through the open space before the section.
    if (rng.chance(0.3)) {
      const prev = track.center;
      for (let i = 1; i <= 3; i++) {
        const k = i / 4;
        builder.orb(track.nextX + spacing * k, prev + (center - prev) * k);
      }
    }

    // Occasionally a power-up floats in the open space between sections, on the flight path.
    if (track.nextX > POWERUPS.minDistance && rng.chance(POWERUPS.chance)) {
      const prev = track.center;
      builder.powerup(track.nextX + spacing * 0.4, prev + (center - prev) * 0.4, pickPowerup(rng));
    }

    const section = PATTERNS[type](builder, x, center, gap, rng);
    track.corridors.push({ type, x0: x, x1: x + section.length, lo: section.lo, hi: section.hi, center });
    track.free[0] = section.free[0];
    track.free[1] = section.free[1];
    track.center = center;
    track.previous = type;
    track.sinceBreather += 1;
    track.nextX = x + section.length;
  }
  // Drop corridors well behind the bird.
  while (track.corridors.length && track.corridors[0].x1 < distance - WORLD.despawnBehind) {
    track.corridors.shift();
  }
}
