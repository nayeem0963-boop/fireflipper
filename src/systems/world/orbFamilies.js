/**
 * Score orb families: the LOOK of the orbs, as pure data and maths (no three.js, no randomness), so the renderer and the tests share it. Purely visual: nothing here is read by the simulation,
 * the collision, the scoring or the Auto play bot (an orb's position, size of hitbox, value and spawn are exactly what they were); `OrbField` only asks which family to draw an orb in.
 *
 * Five families, one per world, in the order of the journey: Solar, Frost, Cosmic, Nature, Celestial. Each is a painted orb (public/images/orbs/orbs.webp: one atlas, one 192 px cell per family,
 * in this order; see the README there) with its own gentle motion. `tone` is the colour of the picture's rim, i.e. what meets the backdrop; `halo` colours the deep underlay glow (normally blended) behind it in every world, so the orb reads against pale
 * scenery (the rim shows against dark void, the underlay against pale crystals). Readability is measured by scripts/orb-families-test.mjs with the same contrast rule as the obstacles.
 *
 * Distribution: every world has a PRIMARY family and an ACCENT, the next world's family. A world's orbs are the primary family, except that through the second half of the world a growing share
 * (0 to ACCENT_MAX) are the accent, a gentle preview of what is coming, so a border is a gradual mix and never a sudden switch. The last world has no accent (the finale is pure Celestial).
 * The choice is made per CLUSTER of orbs (a trail stays one family) by a hash of the position: deterministic, no random numbers, the same on every run and frame rate.
 */
import { WORLDS, WORLD_LENGTH } from './worlds.js';
import { hash01 } from '../obstacles/rockShapes.js';

/** `glow`: a brightness lift for the picture (1 = as painted; the darker pictures are lifted so they read at flying speed). `sway`: how far (radians) and how fast (rad/s) the picture rocks; `bob`: float height (world units, visual only); `pulse`: size pulse; speeds are in rad/s. */
export const ORB_FAMILIES = Object.freeze({
  solar: Object.freeze({ id: 'solar', name: 'Solar', tone: '#da9029', halo: '#2a0a50', glow: 1.0, sway: 0.3, swaySpeed: 1.3, bob: 0.12, bobSpeed: 2.6, pulse: 0.14, pulseSpeed: 6 }),
  frost: Object.freeze({ id: 'frost', name: 'Frost', tone: '#b6cddd', halo: '#06265e', glow: 1.0, sway: 0.22, swaySpeed: 0.9, bob: 0.1, bobSpeed: 2.1, pulse: 0.08, pulseSpeed: 4 }),
  cosmic: Object.freeze({ id: 'cosmic', name: 'Cosmic', tone: '#827294', halo: '#1a0638', glow: 1.55, sway: 0.35, swaySpeed: 1.7, bob: 0.12, bobSpeed: 3.2, pulse: 0.1, pulseSpeed: 7 }),
  nature: Object.freeze({ id: 'nature', name: 'Nature', tone: '#648571', halo: '#031a0d', glow: 1.45, sway: 0.28, swaySpeed: 1.1, bob: 0.1, bobSpeed: 1.9, pulse: 0.09, pulseSpeed: 3 }),
  celestial: Object.freeze({ id: 'celestial', name: 'Celestial', tone: '#ddced4', halo: '#3a1260', glow: 1.0, sway: 0.2, swaySpeed: 1.0, bob: 0.15, bobSpeed: 2.3, pulse: 0.12, pulseSpeed: 5 }),
});
export const ORB_FAMILY_IDS = Object.freeze(['solar', 'frost', 'cosmic', 'nature', 'celestial']);

/** Per world (same order as WORLDS): the primary family and the accent (the next world's family, or null for the last world). */
export const WORLD_ORBS = Object.freeze(WORLDS.map((w, i) => Object.freeze({ world: w.id, primary: ORB_FAMILY_IDS[i], accent: ORB_FAMILY_IDS[i + 1] ?? null })));

/** The accent never exceeds this share of a world's orbs; it begins after ACCENT_FROM of the world and ramps up smoothly. */
export const ACCENT_MAX = 0.4;
export const ACCENT_FROM = 0.4;
/** Orbs within the same CLUSTER metres share a family, so a trail of orbs stays one colour. */
export const CLUSTER = 30;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const worldIndex = (x) => Math.min(WORLDS.length - 1, Math.max(0, Math.floor(x / WORLD_LENGTH)));

/** The share (0 to ACCENT_MAX) of the orbs at track position `x` that are the accent family. */
export function accentShare(x) {
  const w = WORLDS[worldIndex(x)];
  if (!WORLD_ORBS[w.index].accent) return 0;
  return ACCENT_MAX * smooth(ACCENT_FROM, 1, (x - w.start) / WORLD_LENGTH);
}

/** The family id an orb at track position `x` is drawn in. Pure and deterministic (a hash of the position's cluster). */
export function orbFamilyAt(x) {
  const wo = WORLD_ORBS[worldIndex(x)];
  return wo.accent && hash01(Math.floor(x / CLUSTER) * 3.7 + 11.1) < accentShare(x) ? wo.accent : wo.primary;
}
