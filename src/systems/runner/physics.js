import { RUN } from './constants.js';

/**
 * The runner's movement, as pure functions over a plain `bird` object, so the simulation, the Auto play bot (which plans by
 * stepping a copy) and the tests all run the very same code.
 *
 * bird: { y (feet height), vy, grounded, sinceGround, buffer, sinceFlap }
 * input: { holding, dive }
 */

/** Presses the jump: it is remembered for a moment, so a press just before landing (or just after an edge) still counts. */
export function pressJump(bird) {
  bird.buffer = RUN.jumpBuffer;
}

/** Starts a jump if one is waiting and she is on the land (or only just left it). Returns true when she jumped. */
export function tryJump(bird) {
  if (bird.buffer > 0 && (bird.grounded || bird.sinceGround <= RUN.coyoteTime) && bird.vy <= 0) {
    bird.vy = RUN.jumpSpeed;
    bird.grounded = false;
    bird.sinceGround = 99; // no second jump from the same takeoff
    bird.sinceFlap = 0;
    bird.buffer = 0;
    return true;
  }
  return false;
}

/**
 * One physics step. `supported` says whether there is land under her at this position (false over a pit).
 * Returns true if she jumped this step.
 */
export function stepRunner(bird, input, dt, supported) {
  const jumped = tryJump(bird);
  let g = RUN.gravity;
  if (bird.vy > 0 && !input.holding) g *= RUN.cutGravityScale; // let go early: a hop
  else if (bird.vy < 0 && input.dive) g *= RUN.diveGravityScale; // Down: fall fast

  bird.vy = Math.max(bird.vy + g * dt, RUN.maxFallSpeed);
  bird.y += bird.vy * dt;

  if (supported && bird.y <= RUN.groundY && bird.vy <= 0) {
    bird.y = RUN.groundY;
    bird.vy = 0;
    bird.grounded = true;
    bird.sinceGround = 0;
  } else {
    if (bird.grounded) bird.sinceGround = 0; // just left the land (a jump, or the edge of a pit)
    bird.grounded = false;
    bird.sinceGround += dt;
  }
  if (bird.buffer > 0) bird.buffer = Math.max(0, bird.buffer - dt);
  bird.sinceFlap += dt;
  return jumped;
}
