import { WORLD } from './constants.js';

/** The run speed (m/s) as a function of the distance: it ramps from the base to the maximum speed over `WORLD.speedRampDistance`. Kept apart from the spawner so the hazards can share it without a circular import. */
export function speedAt(distance) {
  const k = Math.min(1, Math.max(0, distance / WORLD.speedRampDistance));
  return WORLD.baseSpeed + (WORLD.maxSpeed - WORLD.baseSpeed) * k;
}
