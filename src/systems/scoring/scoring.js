import { SCORING } from '../physics/constants.js';

/** Pure scoring helpers: no React, no Three.js, unit-testable. */

export function toMetres(distanceUnits) {
  return Math.max(0, Math.floor(distanceUnits));
}

export function computeScore(metres, orbs, bonus = 0) {
  return metres * SCORING.pointsPerMetre + orbs * SCORING.orbPoints + bonus;
}

/**
 * Splits a finished run's score into its three sources for the game-over screen. Display only: it
 * restates `computeScore` and never changes it. Near-miss points are what remains after distance and
 * orbs, because the result carries only the total (the streak multiplier lives in the sim).
 */
export function scoreBreakdown({ score, distance, orbs }) {
  const distancePoints = distance * SCORING.pointsPerMetre;
  const orbPoints = orbs * SCORING.orbPoints;
  return { distancePoints, orbPoints, nearMissPoints: score - distancePoints - orbPoints };
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
