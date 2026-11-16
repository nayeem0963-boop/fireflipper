/** Pure scoring helpers: no React, no Three.js, easy to unit test. */

/** World units per displayed metre. */
export const UNITS_PER_METRE = 1;

export function toMetres(distanceUnits) {
  return Math.floor(distanceUnits / UNITS_PER_METRE);
}

export function formatDistance(distanceUnits) {
  return `${toMetres(distanceUnits).toLocaleString()} m`;
}

export function formatScore(score) {
  return score.toLocaleString();
}
