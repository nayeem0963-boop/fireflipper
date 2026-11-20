/**
 * Power-ups: the MAGNET and the SHIELD. Pure data and maths (no three.js, no React, no random numbers), shared by the simulation, the spawner, the Auto play bot, the renderers and the tests.
 *
 *  - Magnet: for MAGNET_S seconds, score orbs within MAGNET_RANGE metres of the bird drift toward it (MAGNET_PULL m/s). Collecting is unchanged: an orb still counts when the existing circle test
 *    says it touches the bird, so the magnet only brings orbs into reach.
 *  - Shield: lasts SHIELD_S seconds (a timer in the HUD) and absorbs ONE crash (an obstacle, the lava or a flying hazard). The bird is put back in the guaranteed gap (or bounced off the floor), flashes, and is immune for GRACE_S seconds; then the shield is gone. If the timer runs out first, the shield is gone unused.
 *
 * Where they appear: about one every 800 to 1,200 m (SLOTS, from position hashes, alternating magnet and shield: about nine in the journey). A slot is filled by the first obstacle section
 * after it that has no orb trail, with the item placed ITEM_BEFORE metres before that section's start, in line with the middle of its guaranteed gap (so it is always reachable and never
 * inside a section). No random number is drawn, so every generated track is exactly what it was without power-ups (`POWERUPS.enabled = false` brings back the track without items).
 */
import { hash01 } from '../obstacles/rockShapes.js';
import { FINISH_CLEAR, JOURNEY_LENGTH } from '../world/worlds.js';

/** Master switch: false spawns no items (and the tests use it to prove the tracks are unchanged). */
export const POWERUPS = { enabled: true };

export const MAGNET_S = 8;
export const SHIELD_S = 15;
export const MAGNET_RANGE = 4;
export const MAGNET_PULL = 14;
export const GRACE_S = 1.5;
/** Pickup radius of an item (an orb's is 0.35); the bird's own radius is added, as for orbs. */
export const ITEM_RADIUS = 0.55;
/** Metres before a section's start that its item sits. */
export const ITEM_BEFORE = 5;

export const KINDS = Object.freeze(['magnet', 'shield']);

/** The positions (m) where an item is due, in order, with its kind. The first is after about 700 m; the last well before the finish line's clear stretch. */
export const SLOTS = (() => {
  const out = [];
  let x = 700 + 300 * hash01(1.7);
  for (let n = 0; x < JOURNEY_LENGTH - FINISH_CLEAR - 250; n++) {
    out.push(Object.freeze({ x, kind: KINDS[n % 2] }));
    x += 800 + 400 * hash01((n + 1) * 4.1 + 2.3);
  }
  return Object.freeze(out);
})();
