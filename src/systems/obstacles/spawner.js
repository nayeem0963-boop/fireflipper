import { WORLD } from '../physics/constants.js';
import { PATTERNS, gapFor, pickPattern } from './patterns.js';
import { speedAt } from '../physics/speed.js';
import { HAZARDS, runwayAfter } from '../hazards/biomeHazards.js';
import { FINISH_CLEAR, JOURNEY_LENGTH } from '../world/worlds.js';
import { ITEM_BEFORE, POWERUPS, SLOTS } from '../powerups/powerups.js';
import { FLIERS, flierBandAfter } from '../fliers/fliers.js';

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
/** The longest section a pattern builds (the passage, 7 to 12 m, plus a margin). */
const SECTION_MAX = 12.5;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Where the DIFFICULTY starts to rise (m): the opening runway is always at difficulty 0. */
const DIFFICULTY_FROM = 40;

/**
 * Difficulty 0..1 as a function of distance travelled: one smooth, steady climb over the whole journey, from 0 at the start to 1 (the hardest the game has ever been: the gaps, spacing and pattern mix
 * the old endless run held from about 1,600 m on) at the finish line. It does not depend on the world borders, so nothing jumps at 2,000, 4,000, 6,000 or 8,000 m; each world averages 0.1, 0.3, 0.5, 0.7 and 0.9.
 */
export function difficultyAt(distance) {
  return clamp((distance - DIFFICULTY_FROM) / (JOURNEY_LENGTH - DIFFICULTY_FROM), 0, 1);
}

export { speedAt };

export function createTrack() {
  return { nextX: 0, free: [0, 0], center: 0, previous: null, corridors: [], finished: false, nextPowerup: 0 };
}

export function resetTrack(track, startY) {
  track.nextX = WORLD.runway;
  track.free[0] = track.free[1] = startY;
  track.center = startY;
  track.previous = null;
  track.corridors.length = 0;
  track.finished = false;
  track.nextPowerup = 0;
}

/** Generate sections until the track extends `spawnAhead` past `distance`. */
export function fillTrack(track, builder, distance, rng) {
  while (track.nextX < distance + WORLD.spawnAhead) {
    // The finish line: no section is built that could reach into the last FINISH_CLEAR metres, so the ending is never an obstacle course and nothing spawns beyond it.
    // (The shortest gap between sections is 7.5 m, so a section can start no earlier than nextX + 7.5; SECTION_MAX bounds how far it reaches.)
    if (track.nextX + 7.5 + SECTION_MAX > JOURNEY_LENGTH - FINISH_CLEAR) {
      track.finished = true;
      break;
    }
    const t = difficultyAt(track.nextX);
    const type = pickPattern(track.nextX, t, rng, track.previous);
    const gap = gapFor(type, t, rng);
    const spacing = 12 + (7.5 - 12) * t + rng.range(0, 2.5);
    // With the biome hazards on, a hazard window owns its stretch of the track: a section never starts inside one (the window, its telegraph and the bird's settling time
    // all fit in open space). The extra runway is deterministic and draws no random number; with the hazards off this is exactly the original spacing.
    const gapX = track.nextX + spacing;
    // A flying hazard's band is kept clear too (see systems/fliers): the section just starts later, the same way, with no random number drawn. The two reservations are applied until neither moves it.
    let x = gapX;
    for (let i = 0; i < 8; i++) {
      const a = HAZARDS.enabled ? runwayAfter(x, SECTION_MAX) : x;
      const b = FLIERS.enabled ? flierBandAfter(a, SECTION_MAX) : a;
      if (b === x) break;
      x = b;
    }
    const time = Math.max(0.25, (x - track.nextX - SETTLE_DISTANCE) / speedAt(track.nextX));

    // Corridor centre must be in the playable band...
    const minC = WORLD.groundY + gap / 2 + 0.5;
    const maxC = WORLD.ceilingY - gap / 2 - 0.2;
    // ...and reachable from both extremes of where the bird may be.
    let lo = Math.max(minC, track.free[1] - MAX_DROP_RATE * time);
    let hi = Math.min(maxC, track.free[0] + MAX_RISE_RATE * time);
    if (lo > hi) lo = hi = clamp((lo + hi) / 2, minC, maxC);
    const center = rng.range(lo, hi);

    // Sometimes leave a trail of orbs through the open space before the section.
    const trail = rng.chance(0.3);
    if (trail) {
      const prev = track.center;
      for (let i = 1; i <= 3; i++) {
        const k = i / 4;
        builder.orb(track.nextX + spacing * k, prev + (center - prev) * k);
      }
    }

    // A due power-up goes just before this section, in line with the middle of its guaranteed gap (reachable by construction, never inside a section); a section with an orb trail waits for the next one.
    // No random number is drawn here, so the sections and orbs are exactly what they are without power-ups.
    if (POWERUPS.enabled && builder.item && !trail) {
      const slot = SLOTS[track.nextPowerup];
      if (slot && x - ITEM_BEFORE >= slot.x) {
        builder.item(slot.kind, x - ITEM_BEFORE, center);
        track.nextPowerup++;
      }
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
