import { SCORING } from '../physics/constants.js';

/** Pure scoring helpers: no React, no Three.js, unit-testable. */

export function toMetres(distanceUnits) {
  return Math.max(0, Math.floor(distanceUnits));
}

/** Distance points plus every bonus earned so far (already multiplied when earned). */
export function computeScore(metres, bonusPoints = 0) {
  return metres * SCORING.pointsPerMetre + bonusPoints;
}

export function formatDistance(metres) {
  return `${metres.toLocaleString()} m`;
}

export function formatScore(score) {
  return score.toLocaleString();
}
