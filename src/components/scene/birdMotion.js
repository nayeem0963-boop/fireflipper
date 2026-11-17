/**
 * Shared wing motion for the code-built birds: how far the wings are raised (radians, positive = up) from the
 * simulation's flight state. The same shape as the original firebird: a quick snap up, a powered downstroke, a
 * recovery, then a gentle beat between flaps; tucked back in a dive and limp after a crash.
 */
export const STROKE_TIME = 0.26; // seconds for one powered wing stroke

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOut = (u) => 1 - (1 - u) * (1 - u);
const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

/** Wing angle over one flap: snap up, power down, recover. u in [0, 1). */
export function flapStroke(u) {
  if (u < 0.12) return 0.4 + (1.05 - 0.4) * easeOut(u / 0.12);
  if (u < 0.5) return 1.05 + (-0.8 - 1.05) * easeOut((u - 0.12) / 0.38);
  return -0.8 + (0.3 + 0.8) * easeInOut((u - 0.5) / 0.5);
}

/**
 * Target wing lift for this moment. `beat` is a sine of the idle wing-beat phase. Without `flight` (menu preview)
 * the wings just beat gently.
 */
export function wingLiftTarget(flight, beat) {
  if (!flight) return 0.25 + beat * 0.5;
  if (flight.dead) return -0.35 + beat * 0.08;
  if (flight.sinceFlap < STROKE_TIME) return flapStroke(flight.sinceFlap / STROKE_TIME);
  const tuck = clamp01((-flight.vy - 5) / 7);
  return 0.25 - tuck * 0.2 + beat * 0.5 * (1 - tuck * 0.85);
}
