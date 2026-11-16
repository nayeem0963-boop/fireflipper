import { PHYSICS, WORLD } from './constants.js';

/**
 * Flight model for the firebird. Pure functions over a plain `bird` object
 * so the same code runs in the game and in headless tests.
 *
 * bird: { y, vy, pitch, sinceFlap }
 * input: { holding, dive }
 */

export function applyFlap(bird) {
  bird.vy = Math.min(PHYSICS.maxRiseSpeed, Math.max(bird.vy, 0) * PHYSICS.flapCarry + PHYSICS.flapImpulse);
  bird.sinceFlap = 0;
}

export function stepFlight(bird, input, dt) {
  let g = PHYSICS.gravity;
  if (input.dive) g *= PHYSICS.diveGravityScale;
  else if (input.holding && bird.vy > 0) g *= PHYSICS.holdGravityScale;

  bird.vy += g * dt;

  if (input.dive) {
    if (bird.vy < PHYSICS.maxDiveSpeed) bird.vy = PHYSICS.maxDiveSpeed;
  } else if (bird.vy < PHYSICS.maxFallSpeed) {
    // Ease out of a dive instead of snapping to terminal velocity.
    bird.vy = Math.min(PHYSICS.maxFallSpeed, bird.vy + PHYSICS.diveRecovery * dt);
  }

  bird.y += bird.vy * dt;
  if (bird.y > WORLD.ceilingY) {
    bird.y = WORLD.ceilingY;
    if (bird.vy > 0) bird.vy = 0;
  }

  // Nose follows velocity: up when climbing, down when diving.
  const targetPitch = Math.max(-1.0, Math.min(0.5, bird.vy * 0.065));
  bird.pitch += (targetPitch - bird.pitch) * (1 - Math.exp(-10 * dt));
  bird.sinceFlap += dt;
}
