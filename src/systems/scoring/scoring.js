import { SCORING } from '../physics/constants.js';

/** Pure scoring helpers: no React, no Three.js, unit-testable. */

export function toMetres(distanceUnits) {
  return Math.max(0, Math.floor(distanceUnits));
}

export function computeScore(metres, orbs, gems = 0, rings = 0) {
  return metres * SCORING.pointsPerMetre + orbs * SCORING.orbPoints + gems * SCORING.gemPoints + rings * SCORING.ringPoints;
}

export function formatDistance(metres) {
  return `${metres.toLocaleString()} m`;
}

export function formatScore(score) {
  return score.toLocaleString();
}
