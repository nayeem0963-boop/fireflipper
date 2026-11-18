import { createEmitter } from '../../utils/emitter.js';

/**
 * Gameplay events emitted by the simulation (via the game loop) for
 * feedback systems: audio, particles, HUD effects. Payloads are plain
 * objects in track coordinates ({ x, y }).
 */
export const GAME_EVENTS = Object.freeze({
  START: 'start',
  FLAP: 'flap',
  ORB: 'orb',
  /** Bird passed an obstacle with very little clearance: { x, y, clearance, side }. */
  NEAR_MISS: 'nearMiss',
  /** { x, y, cause: 'obstacle' | 'lava', speed } */
  CRASH: 'crash',
  OVER: 'over',
});

export const gameEvents = createEmitter();
