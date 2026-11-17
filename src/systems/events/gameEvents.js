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
  NEAR_MISS: 'nearMiss',
  POWERUP: 'powerup',
  SHIELD_BREAK: 'shieldBreak',
  ROCK_IMPACT: 'rockImpact',
  CRASH: 'crash',
  OVER: 'over',
});

export const gameEvents = createEmitter();
