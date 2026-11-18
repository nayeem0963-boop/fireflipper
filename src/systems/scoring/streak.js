import { STREAK } from '../physics/constants.js';

/** Multiplier for a streak of `count` collections. */
export function multiplierFor(count) {
  let mult = 1;
  for (const t of STREAK.tiers) if (count >= t.at) mult = t.mult;
  return mult;
}

/** Collections needed for the next multiplier, or null at the top tier. */
export function nextTier(count) {
  for (const t of STREAK.tiers) if (count < t.at) return t;
  return null;
}

/** Points for a bonus: base value times the multiplier, rounded. Distance never goes through this. */
export function bonusPoints(base, mult) {
  return Math.round(base * mult);
}

/** Near-miss base value by tightness (0 = just inside the threshold, 1 = a graze). */
export function nearMissBase(tight, min, max) {
  return Math.round(min + (max - min) * Math.max(0, Math.min(1, tight)));
}
