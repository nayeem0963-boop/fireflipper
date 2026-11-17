/**
 * Vibration feedback for touch devices. Safe to call anywhere: it does
 * nothing where the Vibration API is missing (desktop browsers, iOS Safari).
 * The Settings toggle decides whether callers invoke it at all.
 */
export function isHapticsSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function vibrate(pattern) {
  if (!isHapticsSupported()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* some browsers throw without a recent user gesture; feedback is optional */
  }
}

/** Patterns in milliseconds: [vibrate, pause, vibrate, ...]. Kept short so they feel like taps. */
export const HAPTIC = Object.freeze({
  orb: 8,
  nearMiss: 14,
  powerup: [14, 30, 14],
  shieldBreak: 35,
  crash: [60, 40, 90],
});
