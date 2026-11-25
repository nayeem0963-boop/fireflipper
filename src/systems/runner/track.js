import { WORLD } from '../physics/constants.js';
import { speedAt } from '../physics/speed.js';
import { difficultyAt } from '../obstacles/spawner.js';
import { FINISH_CLEAR, JOURNEY_LENGTH } from '../world/worlds.js';
import { FULL_JUMP_TIME, RUN, airTimeAbove } from './constants.js';

/**
 * The runner's obstacles (the v2 game): ground obstacles she jumps, and pits she jumps across, laid out along the land.
 *
 * Every section is FAIR BY CONSTRUCTION. Her full-power jump is known exactly (constants.js), so a section is only built when
 * a player who holds the jump clears all of it with room to spare at the slowest speed it can be met at:
 *  - an obstacle of height h can be cleared for `airTimeAbove(h)` seconds, so a cluster whose swept span (its length plus her
 *    body) is at most 85% of speed × that time always fits inside one jump;
 *  - a pit is crossed by a jump that lasts `FULL_JUMP_TIME`, so its open width is held to well under what a jump covers;
 *  - between sections there is always enough land to land, react and take off again.
 * Difficulty (the flying game's own steady 0 to 1 climb over the journey) only raises the heights, the share of the harder
 * sections and tightens the spacing; it never breaks these limits. scripts/runner-test.mjs checks the guarantees with the bot.
 */
const SECTION_MAX = 16;
const FIT = 0.85; // the share of a jump's reach a section may use
const BODY = 2 * RUN.hitCircles[0].r; // her collider's width: it sweeps this much beyond an obstacle's edges

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createRunnerTrack() {
  return { nextX: 0, finished: false, last: null };
}

export function resetRunnerTrack(track) {
  track.nextX = WORLD.runway;
  track.finished = false;
  track.last = null;
}

/** Land needed between two sections (m): time to land, react and take off, scaled by speed, shrinking a little with difficulty. */
export function minSpacing(speed, difficulty) {
  return (0.8 - 0.1 * difficulty) * speed + 3;
}

/** True when a section of swept length `span` whose tallest obstacle is `h` fits inside one full jump at `speed`. */
export function fitsOneJump(span, h, speed) {
  return span + BODY <= FIT * speed * airTimeAbove(h + 0.05);
}

/** Fills the track ahead of `distance`. `builder` has block(look, x0, x1, h), pit(x0, x1) and orb(x, y). */
export function fillRunnerTrack(track, builder, distance, rng) {
  while (track.nextX < distance + WORLD.spawnAhead) {
    // No section reaches into the last FINISH_CLEAR metres: the finish is never an obstacle course.
    if (track.nextX + SECTION_MAX > JOURNEY_LENGTH - FINISH_CLEAR) {
      track.finished = true;
      break;
    }
    const x0 = track.nextX;
    const d = difficultyAt(x0);
    const v = speedAt(x0); // the slowest speed this section is met at, as the speed only ever rises
    const end = buildSection(builder, rng, x0, d, v);
    // Orbs on the land before the next section (the run's reward), then the gap itself.
    const gap = minSpacing(speedAt(end), d) + rng.range(0, 6 * (1 - 0.6 * d));
    lineOfOrbs(builder, rng, end + 1.2, end + gap - 1.5);
    track.last = { x0, x1: end };
    track.nextX = end + gap;
  }
}

/** One section: returns the x where it ends. */
function buildSection(builder, rng, x0, d, v) {
  const r = rng();
  if (d > 0.04 && r < 0.12 + 0.22 * d) return pit(builder, rng, x0, d, v);
  if (d > 0.18 && r < 0.36 + 0.3 * d) return pair(builder, rng, x0, d, v);
  return single(builder, rng, x0, d, v);
}

/** One obstacle: a low rock, an ice spike or a fallen log. */
function single(builder, rng, x0, d, v) {
  const pick = rng();
  let look;
  let w;
  let h;
  if (pick < 0.4) {
    look = 'rock';
    w = rng.range(0.9, 1.4);
    h = rng.range(0.6, 0.75 + 0.2 * d);
  } else if (pick < 0.72) {
    look = 'ice';
    w = rng.range(0.7, 1.0);
    h = rng.range(0.75, 0.85 + 0.15 * d);
  } else {
    look = 'log';
    w = rng.range(1.8, 2.4);
    h = rng.range(0.5, 0.65);
  }
  // (the limits above always fit at the speeds a section can be met at; this guards any future change to them)
  while (!fitsOneJump(w, h, v) && w > 0.6) w *= 0.92;
  builder.block(look, x0, x0 + w, h);
  arcOfOrbs(builder, x0, x0 + w, h);
  return x0 + w;
}

/** Two close obstacles that one full jump clears together. Falls back to one when they would not fit. */
function pair(builder, rng, x0, d, v) {
  const w1 = rng.range(0.8, 1.1);
  const w2 = rng.range(0.8, 1.1);
  const h1 = rng.range(0.6, 0.75 + 0.15 * d);
  const h2 = rng.range(0.6, 0.75 + 0.15 * d);
  const sep = rng.range(0.9, 1.5);
  const span = w1 + sep + w2;
  if (!fitsOneJump(span, Math.max(h1, h2), v)) return single(builder, rng, x0, d, v);
  builder.block('rock', x0, x0 + w1, h1);
  builder.block('ice', x0 + w1 + sep, x0 + span, h2);
  arcOfOrbs(builder, x0, x0 + span, Math.max(h1, h2));
  return x0 + span;
}

/** A pit in the land: she has to jump across it. Its open width (inside the forgiving lips) is held well under a jump's reach. */
function pit(builder, rng, x0, d, v) {
  const reach = FIT * v * FULL_JUMP_TIME - BODY; // how much open ground a full jump covers at this speed, with room to spare
  const open = Math.min(rng.range(1.6, 2.4 + 1.2 * d), reach);
  const w = open + 2 * RUN.pitLip;
  builder.pit(x0, x0 + w);
  arcOfOrbs(builder, x0, x0 + w, 0.2);
  return x0 + w;
}

/** A few orbs at chest height on the open land: collected simply by running through them. */
function lineOfOrbs(builder, rng, xa, xb) {
  if (xb - xa < 2 || !rng.chance(0.7)) return;
  const n = clamp(Math.floor((xb - xa) / 1.3), 2, 6);
  const start = xa + (xb - xa - (n - 1) * 1.3) / 2;
  for (let i = 0; i < n; i++) builder.orb(start + i * 1.3, RUN.groundY + 1.1);
}

/** An arc of orbs over an obstacle or a pit: the reward for jumping it well. It follows the full jump's own curve. */
function arcOfOrbs(builder, xa, xb, h) {
  const mid = (xa + xb) / 2;
  const half = (xb - xa) / 2 + 0.9;
  for (let i = -2; i <= 2; i++) {
    const t = i / 2;
    builder.orb(mid + t * half, RUN.groundY + h + 1.25 + (1 - t * t) * 0.5); // her torso circle passes through: feet at about the obstacle's top
  }
}
