import { WORLD } from '../physics/constants.js';

/**
 * The ground-runner ruleset (the v2 game). Pure data, shared by the runner simulation, its obstacle generator, its Auto play
 * bot and the headless tests. Units: world units (1 unit = 1 metre of distance) and seconds, as in the flying game.
 *
 * The runner runs ON THE LAND: the floor of whichever world she is in (the flying game's lava plane, drawn as canyon dust,
 * snow, cloud sea and so on). `y` in the runner's state is the height of her FEET, so standing on the land is `y = RUN.groundY`.
 */
export const RUN = Object.freeze({
  /** The land: the height of her feet while she stands on it. The scenery's floor is drawn at this height. */
  groundY: WORLD.groundY,
  gravity: -30,
  /** Upward speed of a jump. Holding the jump input keeps full power: apex 2.0 (11² / 60); letting go early cuts it short. */
  jumpSpeed: 11,
  /** Gravity multiplier while rising with the input released: a tap is a hop (apex about 1.2), holding is a full jump (about 2.0). */
  cutGravityScale: 1.7,
  /** Gravity multiplier while falling with Down held: drop back to the land quickly. */
  diveGravityScale: 2.4,
  maxFallSpeed: -22,
  /** A jump pressed this long after running off an edge still works (seconds), and one pressed this long before landing waits for the landing. */
  coyoteTime: 0.09,
  jumpBuffer: 0.11,

  /**
   * Her collider: two circles stacked along her body, positions relative to her feet. They sit a little inside her drawn body
   * (as the bird's collider does) and her head is above them, so only what reaches her legs and torso can hurt her.
   */
  hitCircles: Object.freeze([
    Object.freeze({ dx: 0, dy: 0.4, r: 0.34 }),
    Object.freeze({ dx: 0, dy: 1.08, r: 0.34 }),
  ]),
  /** A pit (crevasse) only drops her when her feet are more than this far inside its edges: a forgiving lip. */
  pitLip: 0.28,
  /** Feet this far below the land and she has fallen into a pit for good. */
  pitDeathDepth: 1.4,
  /** Orbs are picked up by a circle test around each body circle, like the flying game's. */
  orbRadius: 0.35,
  /** Passing an obstacle with less clearance than this (world units) counts as a near miss. */
  nearMissGap: 0.3,
});

/** Time (s) a full-power jump keeps her feet above height `h` (the analytic jump, used to size obstacles so they can always be cleared). */
export function airTimeAbove(h) {
  const disc = RUN.jumpSpeed * RUN.jumpSpeed + 2 * RUN.gravity * h; // v² - 2·|g|·h
  return disc <= 0 ? 0 : (2 * Math.sqrt(disc)) / -RUN.gravity;
}

/** Total airtime (s) of a full-power jump over flat land. */
export const FULL_JUMP_TIME = (2 * RUN.jumpSpeed) / -RUN.gravity;
