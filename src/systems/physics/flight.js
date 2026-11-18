import { PHYSICS, WORLD } from './constants.js';

/**
 * Flight model for the firebird. Pure functions over a plain `bird` object
 * so the same code runs in the game and in headless tests. It is always
 * advanced in fixed steps (see fixedStep.js), which is what keeps it
 * identical at every display refresh rate.
 *
 * bird: { y, vy, pitch, pitchVel, roll, rollVel, accel, lastVy, diveAmt, holding, sinceFlap }
 * input: { holding, dive }
 *
 * Feel, in short:
 *  - a flap sets upward speed (unchanged, so the track's reachability model holds)
 *  - gravity eases off near the top of a climb (hang time), and builds up as
 *    the bird falls, so letting go feels weighted rather than linear
 *  - a dive ramps in and out instead of snapping
 *  - pitch and bank are damped springs, so the body overshoots slightly and
 *    settles like a living thing (visual only: never touches the collider)
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function applyFlap(bird) {
  bird.vy = Math.min(PHYSICS.maxRiseSpeed, Math.max(bird.vy, 0) * PHYSICS.flapCarry + PHYSICS.flapImpulse);
  bird.sinceFlap = 0;
}

/** Gravity multiplier for the current velocity. Smooth in vy: no pops. */
export function gravityScale(vy, holding, diveAmt) {
  let scale = 1 - PHYSICS.apexGravityDrop * (1 - smoothstep(0, PHYSICS.apexSpeed, Math.abs(vy)));
  if (vy > 0 && holding) scale *= PHYSICS.holdGravityScale;
  else if (vy < 0) scale += PHYSICS.fallGravityBoost * smoothstep(0, PHYSICS.fallBoostSpeed, -vy);
  return scale + (PHYSICS.diveGravityScale - scale) * diveAmt;
}

/** Semi-implicit damped spring toward `target` (stable at the fixed step). */
function spring(bird, pos, vel, target, stiffness, zeta, dt) {
  const damping = 2 * zeta * Math.sqrt(stiffness);
  bird[vel] += ((target - bird[pos]) * stiffness - bird[vel] * damping) * dt;
  bird[pos] += bird[vel] * dt;
}

export function stepFlight(bird, input, dt) {
  bird.holding = input.holding;
  bird.diveAmt = input.dive
    ? Math.min(1, bird.diveAmt + dt / PHYSICS.diveAttack)
    : Math.max(0, bird.diveAmt - dt / PHYSICS.diveRelease);

  bird.vy += PHYSICS.gravity * gravityScale(bird.vy, input.holding, bird.diveAmt) * dt;

  if (input.dive) {
    // Terminal speed rises smoothly from fall speed to dive speed with the ramp.
    const terminal = PHYSICS.maxFallSpeed + (PHYSICS.maxDiveSpeed - PHYSICS.maxFallSpeed) * bird.diveAmt;
    if (bird.vy < terminal) bird.vy = terminal;
  } else if (bird.vy < PHYSICS.maxFallSpeed) {
    // Ease out of a dive instead of snapping to terminal velocity.
    bird.vy = Math.min(PHYSICS.maxFallSpeed, bird.vy + PHYSICS.diveRecovery * dt);
  }

  bird.y += bird.vy * dt;
  if (bird.y > WORLD.ceilingY) {
    bird.y = WORLD.ceilingY;
    if (bird.vy > 0) bird.vy = 0;
  }

  // Smoothed vertical acceleration drives the bank (a flap leans the body, a
  // long fall settles into a gentle steady tilt).
  const ay = (bird.vy - bird.lastVy) / dt;
  bird.lastVy = bird.vy;
  bird.accel += (ay - bird.accel) * (1 - Math.exp(-PHYSICS.accelSmoothing * dt));

  // Nose follows velocity: up when climbing, down when diving.
  const targetPitch = clamp(bird.vy * 0.065, -1.0, 0.5);
  spring(bird, 'pitch', 'pitchVel', targetPitch, PHYSICS.pitchStiffness, PHYSICS.pitchDamping, dt);
  const targetRoll = clamp(bird.accel * PHYSICS.rollPerAccel, -PHYSICS.maxRoll, PHYSICS.maxRoll);
  spring(bird, 'roll', 'rollVel', targetRoll, PHYSICS.rollStiffness, PHYSICS.rollDamping, dt);

  bird.sinceFlap += dt;
}
