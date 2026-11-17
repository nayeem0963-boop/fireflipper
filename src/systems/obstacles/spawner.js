import { POWERUPS, WORLD } from '../physics/constants.js';
import { PATTERNS, gapFor, pickPattern } from './patterns.js';

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

/** Difficulty 0..1 as a function of distance travelled. */
export function difficultyAt(distance) {
  return clamp((distance - 40) / 1600, 0, 1);
}

export function speedAt(distance) {
  const k = clamp(distance / WORLD.speedRampDistance, 0, 1);
  return WORLD.baseSpeed + (WORLD.maxSpeed - WORLD.baseSpeed) * k;
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
  return { nextX: 0, free: [0, 0], center: 0, previous: null, corridors: [] };
}

export function resetTrack(track, startY) {
  track.nextX = WORLD.runway;
  track.free[0] = track.free[1] = startY;
  track.center = startY;
  track.previous = null;
  track.corridors.length = 0;
}

/** Generate sections until the track extends `spawnAhead` past `distance`. */
export function fillTrack(track, builder, distance, rng) {
  while (track.nextX < distance + WORLD.spawnAhead) {
    const t = difficultyAt(track.nextX);
    const type = pickPattern(track.nextX, t, rng, track.previous);
    const gap = gapFor(type, t, rng);
    const spacing = 12 + (7.5 - 12) * t + rng.range(0, 2.5);
    const x = track.nextX + spacing;
    const time = Math.max(0.25, (spacing - SETTLE_DISTANCE) / speedAt(track.nextX));

    // Corridor centre must be in the playable band...
    const minC = WORLD.groundY + gap / 2 + 0.5;
    const maxC = WORLD.ceilingY - gap / 2 - 0.2;
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
    track.nextX = x + section.length;
  }
  // Drop corridors well behind the bird.
  while (track.corridors.length && track.corridors[0].x1 < distance - WORLD.despawnBehind) {
    track.corridors.shift();
  }
}
