/**
 * Score orb families: the LOOK of the orbs, as pure data and maths (no three.js, no randomness), so the renderer and the tests share it. Purely visual: nothing here is read by the simulation,
 * the collision, the scoring or the Auto play bot (an orb's position, size of hitbox, value and spawn are exactly what they were); `OrbField` only asks which family to draw an orb in.
 *
 * Five families, in the order of the journey (one per world): Solar, Frost, Cosmic, Nature, Celestial. Each has its own silhouette (see components/scene/orbGeometry.js), colours and motion.
 * Colours are chosen to READ against their world's backdrops (scripts/orb-families-test.mjs measures it, with the same contrast rule as the obstacles): a bright world gets a deep underlay glow
 * (`haloDay`, normally blended), the night world an additive glow (`haloNight`) and a mid-brightness ring that still shows against its pale crystals.
 *
 * Distribution: every world has a PRIMARY family and an ACCENT, the next world's family. A world's orbs are the primary family, except that through the second half of the world a growing share
 * (0 to ACCENT_MAX) are the accent, a gentle preview of what is coming, so a border is a gradual mix and never a sudden switch. The last world has no accent (the finale is pure Celestial).
 * The choice is made per CLUSTER of orbs (a trail stays one family) by a hash of the position: deterministic, no random numbers, the same on every run and frame rate.
 */
import { WORLDS, WORLD_LENGTH } from './worlds.js';
import { hash01 } from '../obstacles/rockShapes.js';

/** `spin`: rotation speed in rad/s (the sign is the direction); `bob`: float height (world units, visual only); `pulse`: size pulse; speeds are in rad/s. */
export const ORB_FAMILIES = Object.freeze({
  solar: Object.freeze({ id: 'solar', name: 'Solar', ring: '#ffb81f', core: '#fff7d6', spark: '#ff7a1a', haloNight: '#ff8a24', haloDay: '#3a0f6a', spin: 0.9, bob: 0.12, bobSpeed: 2.6, pulse: 0.14, pulseSpeed: 6 }),
  frost: Object.freeze({ id: 'frost', name: 'Frost', ring: '#55d6ff', core: '#f2fdff', spark: '#b8f0ff', haloNight: '#4aa8ff', haloDay: '#0a3f8f', spin: -0.45, bob: 0.1, bobSpeed: 2.1, pulse: 0.08, pulseSpeed: 4 }),
  cosmic: Object.freeze({ id: 'cosmic', name: 'Cosmic', ring: '#9a35f0', core: '#ffe6ff', spark: '#ff5fd2', haloNight: '#a040ff', haloDay: '#3b0f6e', spin: 1.5, bob: 0.12, bobSpeed: 3.2, pulse: 0.1, pulseSpeed: 7 }),
  nature: Object.freeze({ id: 'nature', name: 'Nature', ring: '#0f9a4a', core: '#f0ffc4', spark: '#9bff5a', haloNight: '#32e08a', haloDay: '#0b4a2a', spin: 0.55, bob: 0.1, bobSpeed: 1.9, pulse: 0.09, pulseSpeed: 3 }),
  celestial: Object.freeze({ id: 'celestial', name: 'Celestial', ring: '#ff8fcf', core: '#ffffff', spark: '#fff0a8', haloNight: '#ffa6e0', haloDay: '#4a1f7a', spin: 0.65, bob: 0.15, bobSpeed: 2.3, pulse: 0.12, pulseSpeed: 5 }),
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
