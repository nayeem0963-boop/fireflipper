import { WORLD } from '../physics/constants.js';
import { hash01 } from '../obstacles/rockShapes.js';

/**
 * The telegraphs of the biome hazards, as pure functions (no three.js, no clock) shared by the renderer (scenes/EmberValley/HazardTelegraph.jsx) and the tests.
 * Everything is a function of the run distance, like the hazards themselves, so it freezes with a pause and needs no reset.
 *
 * Safety rule: every telegraph is drawn BEHIND the gameplay plane (z < 0) or beside an obstacle, and only as soft additive light, so it can never hide the bird, an obstacle or an orb.
 */
/**
 * How each window kind looks. The canyon is warm and dim, so its updraft is additive light; Frosty Polar and the Cloud Sanctuary are BRIGHT, where additive light would vanish, so their gust
 * and low-gravity pocket are tinted (blue, violet) with normal blending and darker particles: every telegraph must read against its own zone.
 */
export const KIND_STYLE = Object.freeze({
  updraft: Object.freeze({ band: '#ff9a3c', dust: '#ffe08a', additive: true }),
  gust: Object.freeze({ band: '#3b8cff', dust: '#1b44b0', additive: false }),
  lowG: Object.freeze({ band: '#9a6cff', dust: '#6a3ce0', additive: false }),
});
/** Windows drawn at once (the renderer's instance budget). */
export const MAX_WINDOWS = 3;
export const PARTICLES = 48;
export const MAX_RAILS = 16;
/** A window is faintly visible from afar. */
export const FAR_GLOW = 0.12;
/** How bright the window is while it acts. */
export const ACTIVE_GLOW = 0.7;
/** Height of the telegraphed band: the whole flight space, ground to a little above the ceiling. */
export const BAND_BOTTOM = WORLD.groundY;
export const BAND_HEIGHT = WORLD.ceilingY + 1.5 - WORLD.groundY;
/** z of the window band and of its particles: behind the gameplay plane. */
export const BAND_Z = -1.2;

/**
 * Brightness (0 to 1) of the window [s, s + len) as the bird at distance `d` approaches it: faint from afar, rising over the `lead` metres of its telegraph to ACTIVE_GLOW, steady with a
 * slow pulse while it acts, gone once the bird has passed. Continuous at every change of state.
 */
export function windowGlow(d, s, len, lead) {
  if (d >= s + len) return 0;
  if (d >= s) return ACTIVE_GLOW + 0.1 * Math.sin(1.1 * (d - s));
  if (d >= s - lead) return FAR_GLOW + (ACTIVE_GLOW - FAR_GLOW) * ((d - (s - lead)) / lead);
  return FAR_GLOW;
}

/**
 * Particle `i` of a window, written into `out` ({ x, y, z }): x is relative to the bird (world x of the window is s - d), y wraps over the flight space, and z is behind the gameplay plane.
 * Updrafts rise, gusts blow up or down (`dir`), low-gravity pockets drift slowly. Deterministic in `d`.
 */
export function particleAt(i, kind, s, len, dir, d, out) {
  const h1 = hash01(i * 1.37 + 0.11);
  const h2 = hash01(i * 2.71 + 0.5);
  const h3 = hash01(i * 4.13 + 0.9);
  const speed = kind === 'lowG' ? 0.015 : kind === 'updraft' ? 0.06 : 0.07;
  const vdir = kind === 'gust' ? dir : 1;
  const f = (((h2 + vdir * d * speed * (0.6 + h3)) % 1) + 1) % 1;
  out.x = s - d + h1 * len + Math.sin(d * (kind === 'gust' ? 0.5 : 0.3) + i) * (kind === 'gust' ? 0.4 : 0.15);
  out.y = BAND_BOTTOM + f * BAND_HEIGHT;
  out.z = -0.3 - 2.2 * h3;
  return out;
}

/**
 * The glowing rail beside a piston obstacle `o` ({ x, y, h, w, cap, pulse }): where the pole travels, so the player sees the room it opens and when it is about to come back.
 * Writes { x, y0, y1, glow } (x relative to the bird at distance `d`; the rail stands just outside the pole).
 */
export function railFor(o, amp, d, out) {
  const away = o.cap > 0 ? -1 : 1;
  const edge = o.cap > 0 ? o.y + o.h / 2 : o.y - o.h / 2; // where the pole's gap end stands at rest
  out.x = o.x - d - (o.w * 0.62 + 0.12);
  out.y0 = edge;
  out.y1 = edge + away * amp;
  out.glow = 0.25 + 0.75 * o.pulse;
  return out;
}
