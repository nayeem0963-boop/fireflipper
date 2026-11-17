import { SCORING } from '../physics/constants.js';

/** Pure scoring helpers: no React, no Three.js, unit-testable. */

export function toMetres(distanceUnits) {
  return Math.max(0, Math.floor(distanceUnits));
}

export function computeScore(metres, orbs, bonus = 0) {
  return metres * SCORING.pointsPerMetre + orbs * SCORING.orbPoints + bonus;
}

/** Near-miss streak multiplier: 1x, 2x, ... capped. */
export function streakMultiplier(streak) {
  return Math.min(Math.max(streak, 1), SCORING.maxStreakMultiplier);
}

export function formatDistance(metres) {
  return `${metres.toLocaleString()} m`;
}

export function formatScore(score) {
  return score.toLocaleString();
}
