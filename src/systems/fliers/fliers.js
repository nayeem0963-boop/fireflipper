/**
 * Flying hazards: five effects that cross the sky toward the bird, introduced one world at a time. Pure data and maths (no three.js, no React, no random numbers), shared by the simulation, the
 * spawner, the Auto play bot, the renderer and the tests.
 *
 *  - Crystal burst (World 1; id 'smoke', the old smoke cloud, now drawn as a fire or ice crystal burst):  HARMLESS. It drifts across; it never touches the bird, an obstacle or an orb, and is drawn behind them. The first, safe introduction.
 *  - Fire ring (World 2) and energy ring (World 3):  GATES: hoops to fly through. Only the TOP and BOTTOM of the rim are lethal: the middle band (where the bird passes through the hoop) is safe, and
 *    so is going round the ring. (Seen from the side a hoop's left and right rim cannot be avoided when flying through it, so they are not lethal.)
 *  - Ember tornado (World 4) and metal disc (World 5):  LETHAL on contact.
 *
 * Every lethal shape is tested at 75% of what is drawn, so the game forgives; a shield absorbs it like any crash. A hazard's place is a pure function of the BIRD'S DISTANCE `d`: it flies toward the bird
 * on a straight line in (distance, track x) and sways vertically on a sine, meeting the bird at its encounter distance `e`:  x(d) = e + drift * (e - d),  y(d) = yc + amp * sin(omega * (d - e)).
 * So it is frame-rate independent, frozen by pause, reset by a retry, and the bot can predict it exactly. It is visible from far off the right edge, about two seconds before it can touch.
 *
 * Schedule: cumulative, one new type per world (the newest type only after 400 m into its world), about one event every 400 m in World 1 down to 200 m in World 5 (EVERY), deterministic from position
 * hashes. The spawner keeps every obstacle section out of a hazard's band (`flierBandAfter`: no random number is drawn; sections just start later), and an event never overlaps a biome hazard window.
 */
import { hash01 } from '../obstacles/rockShapes.js';
import { FINISH_CLEAR, JOURNEY_LENGTH, WORLDS, worldIndexAt } from '../world/worlds.js';
import { windowsIn } from '../hazards/biomeHazards.js';

/** Master switch: false has no hazards and no reserved bands (the tests use it to compare with the track without them). */
export const FLIERS = { enabled: true };

export const KINDS = Object.freeze(['smoke', 'firering', 'energyring', 'tornado', 'disc']);
/** The world (index 0 to 4) each type is introduced in. */
export const INTRO = Object.freeze({ smoke: 0, firering: 1, energyring: 2, tornado: 3, disc: 4 });
/** What each type does to the bird. */
export const ROLE = Object.freeze({ smoke: 'harmless', firering: 'gate', energyring: 'gate', tornado: 'lethal', disc: 'lethal' });

/** Fraction of the drawn size that is dangerous: lethal shapes (and ring rims) are forgiving. */
export const HIT = 0.75;

/**
 * Per type (world units): `half` = half the sprite's size; `body` / `hole` = a ring's outer and hole radius as drawn; `r` = a lethal shape's drawn radius and `seg` the half-length of its vertical
 * capsule (0 for a disc); `drift` = how fast it flies toward the bird (track metres per metre the bird flies); `amp` / `omega` = its vertical sway (metres, radians per metre).
 */
export const SHAPE = Object.freeze({
  smoke: Object.freeze({ half: 2.4, drift: 0.12, amp: 0.7, omega: 0.06 }),
  firering: Object.freeze({ half: 2.015, body: 1.6, hole: 0.83, drift: 0.25, amp: 0.9, omega: 0.1 }),
  energyring: Object.freeze({ half: 2.075, body: 1.6, hole: 0.85, drift: 0.3, amp: 1.0, omega: 0.12 }),
  tornado: Object.freeze({ half: 1.6, r: 0.66, seg: 0.55, drift: 0.4, amp: 1.5, omega: 0.15 }),
  disc: Object.freeze({ half: 1.24, r: 1.1, seg: 0, drift: 0.55, amp: 2.0, omega: 0.2 }),
});

/** The atlas cells (public/images/hazards/hazards.webp, 5 columns of 192 px): one per (type, world) pair that exists, row by row. Must match scripts/build-hazard-atlas.py. */
export const ATLAS_COLS = 5;
export const ATLAS = (() => {
  const map = {};
  let i = 0;
  for (const k of KINDS) for (let w = INTRO[k]; w < WORLDS.length; w++) map[`${k}:${w}`] = { col: i % ATLAS_COLS, row: Math.floor(i / ATLAS_COLS), index: i++ };
  return Object.freeze(map);
})();
export const ATLAS_ROWS = Math.ceil(Object.keys(ATLAS).length / ATLAS_COLS);

/** Average metres between events in each world, rising in frequency: 400, 340, 290, 240, 200. */
export const EVERY = Object.freeze([400, 340, 290, 240, 200]);
/** A world's newest type waits this long (m) after the world's start. */
export const NEW_AFTER = 400;
/** Obstacle sections stay out of [e - BAND_BEFORE, e + BAND_AFTER] of every event. */
export const BAND_BEFORE = 8;
export const BAND_AFTER = 22;

function pickKind(e, h, seen, count) {
  const w = worldIndexAt(e);
  const start = WORLDS[w].start;
  const newest = KINDS.find((k) => INTRO[k] === w);
  const older = KINDS.filter((k) => INTRO[k] < w);
  // the first event of a world after NEW_AFTER m is always its newest type (the introduction); after that the newest type and the older ones alternate (so about half of a world's events are its own)
  if (newest && e - start >= NEW_AFTER && (older.length === 0 || !seen.has(newest) || count % 2 === 0)) return newest;
  if (older.length) return older[Math.min(older.length - 1, Math.floor(hash01(h * 91.7 + e * 0.013) * older.length))];
  return null; // nothing yet in this stretch of the first world (the first, harmless crystal burst arrives after 400 m)
}

/** The events of the journey, in order: { e (encounter distance), kind, yc (centre height at the encounter), dir (+1 or -1: which way it sways first) }. */
export const SLOTS = (() => {
  const out = [];
  const seen = new Set();
  const perWorld = [0, 0, 0, 0, 0];
  let e = NEW_AFTER + 60 * hash01(3.3);
  for (let n = 0; e < JOURNEY_LENGTH - FINISH_CLEAR - 150 && n < 200; n++) {
    // never overlap a biome hazard window (its force, its telegraph or its settling room): slide the event on until it is clear
    for (let tries = 0; tries < 12; tries++) {
      let clash = false;
      windowsIn(e - 60, e + 40, (kind, s, len, lead) => { if (s - lead - 2 < e + 24 && s + len + 6 > e - 50) clash = true; });
      if (!clash) break;
      e += 45;
    }
    const kind = pickKind(e, hash01(n * 7.77 + 1.3), seen, perWorld[worldIndexAt(e)]);
    if (kind) {
      seen.add(kind);
      perWorld[worldIndexAt(e)]++;
      const gate = ROLE[kind] === 'gate';
      const h = hash01(n * 5.13 + 2.2);
      out.push(Object.freeze({ e, kind, yc: gate ? -0.2 + 2.4 * h : -1 + 4 * h, dir: hash01(n * 3.9 + 8.1) < 0.5 ? 1 : -1 }));
    }
    e += EVERY[worldIndexAt(e)] * (0.8 + 0.4 * hash01(n * 2.71 + 0.5));
  }
  return Object.freeze(out);
})();

/** A hazard's place when the bird is at distance `d`, into `out` ({ x (track), y, dx (ahead of the bird) }). */
export function flierPlace(slot, d, out) {
  const s = SHAPE[slot.kind];
  out.x = slot.e + s.drift * (slot.e - d);
  out.dx = out.x - d;
  out.y = slot.yc + slot.dir * s.amp * Math.sin(s.omega * (d - slot.e));
  return out;
}

/**
 * Whether a bird of radius `R` at (x = `bx`, height `by`) touches the hazard `slot`: harmless ones never; a gate's top or bottom rim (forgiving: the middle 75% of its thickness) but never within the
 * middle band the hoop is flown through (|dy| within `mid - half - R`, about 0.57 m of the ring's centre); a lethal shape's 75%-radius capsule. `place` is the hazard's place at `bx` (from flierPlace), reused to avoid allocation.
 */
export function flierHits(slot, place, by, R) {
  const role = ROLE[slot.kind];
  if (role === 'harmless') return false;
  const s = SHAPE[slot.kind];
  const dx = place.dx;
  const dy = by - place.y;
  if (role === 'gate') {
    const mid = (s.body + s.hole) / 2;
    const half = (HIT * (s.body - s.hole)) / 2;
    const tol = mid - half - R; // the bird's centre within this of the hoop's centre passes through it
    return Math.abs(dy) > tol && Math.hypot(dx, dy) < mid + half + R;
  }
  const seg = s.seg;
  const cy = dy > seg ? dy - seg : dy < -seg ? dy + seg : 0;
  return Math.hypot(dx, cy) < s.r * HIT + R;
}

/** Where to put a bird that the shield has just saved from `slot` at height `by`: the middle of a ring's hole, or clear above or below a lethal shape. */
export function flierRescueY(slot, place, by, floorY, ceilingY) {
  const s = SHAPE[slot.kind];
  if (ROLE[slot.kind] === 'gate') return place.y;
  const clear = s.r * HIT + s.seg + 0.8;
  const up = place.y + clear;
  const down = place.y - clear;
  if (by >= place.y) return up <= ceilingY - 0.3 ? up : Math.max(floorY + 0.5, down);
  return down >= floorY + 0.5 ? down : Math.min(ceilingY - 0.3, up);
}

/** The first track position at or after `x` where a section of up to `maxLen` metres can start without touching a hazard's band. Pure and deterministic; draws no random number. */
export function flierBandAfter(x, maxLen) {
  if (!FLIERS.enabled) return x;
  let moved = true;
  while (moved) {
    moved = false;
    for (let i = 0; i < SLOTS.length; i++) {
      const from = SLOTS[i].e - BAND_BEFORE;
      const to = SLOTS[i].e + BAND_AFTER;
      if (x < to && x + maxLen > from) {
        x = to;
        moved = true;
      }
    }
  }
  return x;
}
