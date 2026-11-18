import { createEmitter } from '../../utils/emitter.js';

/**
 * Gameplay events emitted by the simulation (via the game loop) for
 * feedback systems: audio, particles, HUD effects. Payloads are plain
 * objects in track coordinates ({ x, y }).
 */
export const GAME_EVENTS = Object.freeze({
  START: 'start',
  FLAP: 'flap',
  /** { x, y, gem, mult, streak }: a fire orb, or a rare gem when `gem` is true. */
  ORB: 'orb',
  /** Points earned: { points, source: 'orbs'|'gems'|'rings'|'nearMiss'|'other', mult, streak, x, y }. */
  SCORE: 'score',
  /** The streak multiplier went up: { mult, count, x, y }. */
  MULTIPLIER: 'multiplier',
  /** The streak ended: { count, mult, reason: 'timeout' | 'shield' }. */
  STREAK_BREAK: 'streakBreak',
  /** A shield or magnet was picked up: { kind, x, y }. */
  POWERUP: 'powerup',
  /** A shield took a hit: { x, y, cause }. */
  SHIELD_BREAK: 'shieldBreak',
  MAGNET_END: 'magnetEnd',
  /** The bird crossed into a new environment: { index, id, name, tagline }. */
  ENVIRONMENT: 'environment',
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
