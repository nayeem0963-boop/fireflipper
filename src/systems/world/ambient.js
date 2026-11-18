import { WORLD } from '../physics/constants.js';

/**
 * Ambient environment animation, all driven by the run distance (no wall clock): drifting particles (dust, snow, petals, sparkles) and the
 * aurora shimmer. Pure functions, shared by the renderer and the tests. Everything sits BEHIND the flight plane (z < gameplayZ), so
 * nothing here can ever be drawn over the bird, an obstacle or an orb.
 */
export const AMBIENT = {
  /** Particles per zone (one draw call each). The whole game stays under this at any distance. */
  count: 40,
  /** Depth range of particles, all behind the flight plane. */
  zMin: -26,
  zMax: -3,
  /** Horizontal loop length and vertical range (world units above the floor). */
  span: 70,
  height: 20,
};

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Per-zone particle behaviour: fall (units per metre, negative rises), drift (sideways units per metre), size and colour. */
export const DRIFT = {
  canyon: { color: '#f4c28a', size: 0.11, opacity: 0.55, fall: 0.03, drift: 0.12 },
  arctic: { color: '#ffffff', size: 0.13, opacity: 0.85, fall: 0.05, drift: 0.09 },
  celestial: { color: '#cfd2ff', size: 0.1, opacity: 0.8, fall: -0.02, drift: 0.04 },
  palace: { color: '#ffc4d8', size: 0.14, opacity: 0.8, fall: 0.04, drift: 0.1 },
  sanctuary: { color: '#ffe3a0', size: 0.11, opacity: 0.8, fall: -0.025, drift: 0.05 },
};

/** Deterministic particle seeds (u, v across the loop, w for depth and speed variation). */
export function driftItems(seed, count = AMBIENT.count) {
  let s = seed;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: count }, () => ({ u: rand(), v: rand(), w: rand() }));
}

const wrap = (v, span) => ((v % span) + span) % span;

/** Position of a particle (x relative to the camera) for a run distance: moves with the distance only. */
export function driftPoint(it, distance, cfg) {
  const { span, height, zMin, zMax } = AMBIENT;
  const speedK = 0.6 + it.w * 0.8; // nearer particles move faster
  const x = wrap(it.u * span - distance * cfg.drift * 6 * speedK, span) - span / 2;
  const y = WORLD.groundY + height - wrap(it.v * height + distance * cfg.fall * 6 * speedK, height);
  const z = zMin + (zMax - zMin) * it.w;
  return { x, y, z };
}

/** Slow brightness pulse (0..1) with the distance, period in metres. */
export const pulse = (distance, period, phase = 0) => 0.5 + 0.5 * Math.sin((2 * Math.PI * distance) / period + phase);

/**
 * How strong the aurora shimmer is: faint over Crystal Ice Canyon (its sky shows the aurora through the arch), full over Aurora Lake.
 * The zone's own weight multiplies this in the renderer.
 */
export function auroraStrength(distance) {
  const canyon = smooth(1645, 1685, distance) * (1 - smooth(1810, 1850, distance)) * 0.3;
  return Math.max(canyon, smooth(1810, 1850, distance));
}
