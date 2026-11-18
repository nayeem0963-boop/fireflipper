import { createEmitter } from '../../utils/emitter.js';

/**
 * Gameplay events emitted by the simulation (via the game loop) for
 * feedback systems: audio, particles, HUD effects. Payloads are plain
 * objects in track coordinates ({ x, y }).
 */
export const GAME_EVENTS = Object.freeze({
  START: 'start',
  FLAP: 'flap',
  /** { x, y, gem }: a fire orb, or a rare gem when `gem` is true. */
  ORB: 'orb',
  /** The bird flew through the middle of a fire ring: { x, y }. */
  RING: 'ring',
  /** A falling boulder hit the lava: { x, y }. */
  LANDING: 'boulderLand',
  /** Bird passed an obstacle with very little clearance: { x, y, clearance, side }. */
  NEAR_MISS: 'nearMiss',
  /** { x, y, cause: 'obstacle' | 'lava', speed } */
  CRASH: 'crash',
  OVER: 'over',
});

export const gameEvents = createEmitter();
