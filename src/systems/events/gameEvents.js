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
  NEAR: 'near',
  CRASH: 'crash',
  OVER: 'over',
  /** A world was completed (not the last one): { index, at, world, name }. */
  MILESTONE: 'milestone',
  /** The journey was completed at the finish line: the run's results. */
  COMPLETE: 'complete',
  /** A power-up was picked up: { kind: 'magnet' | 'shield', x, y }. */
  POWERUP: 'powerup',
  /** The shield took a crash: { x, y, cause }. */
  SHIELD_BREAK: 'shieldbreak',
});

export const gameEvents = createEmitter();
