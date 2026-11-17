/**
 * Tunable gameplay constants. Pure data: imported by the simulation, the
 * renderers and the headless tests alike.
 * Units: world units (1 unit = 1 metre of distance) and seconds.
 */
export const PHYSICS = Object.freeze({
  gravity: -22,
  /** Upward velocity set by a flap (added to any remaining upward speed). */
  flapImpulse: 7.6,
  /** Fraction of upward speed kept when flapping again mid-climb. */
  flapCarry: 0.3,
  /** Holding the flap input while rising softens gravity (a longer, floatier climb). */
  holdGravityScale: 0.7,
  /** Holding dive (Down / S) pulls the bird down harder. */
  diveGravityScale: 2.1,
  maxRiseSpeed: 9,
  maxFallSpeed: -11,
  maxDiveSpeed: -17,
  /** How quickly fall speed eases back to normal after a dive is released (units/s²). */
  diveRecovery: 30,
  /** Orb pickup radius around the bird's centre (generous on purpose; collisions use BIRD_HITBOX). */
  orbPickupRadius: 0.36,
  /** Height of the body's centre above the ground when the crashed bird lies on it. */
  birdRestHeight: 0.23,
  /** Fixed simulation timestep (s). Rendering interpolates between steps. */
  fixedStep: 1 / 120,
  /** Clamp long frames (tab switch, GC hitch) so the sim never takes huge leaps. */
  maxFrameDelta: 1 / 15,
});

/**
 * The bird's collider: circles in bird-local space (x forward, y up) that
 * rotate with the bird's pitch, exactly like the drawn model does.
 * Fitted to the placeholder firebird as drawn by PlayerBird (scale 0.6):
 * body ≈ 0.375 × 0.246 half-extents, head radius 0.18 at (0.36, 0.18).
 * Each circle sits slightly inside the outline for fairness. Wings, tail and
 * the thin beak tip never collide. Refit this when the bird model changes.
 */
export const BIRD_HITBOX = Object.freeze([
  Object.freeze({ x: 0, y: 0, r: 0.23 }), // body centre
  Object.freeze({ x: -0.17, y: 0, r: 0.2 }), // rear body
  Object.freeze({ x: 0.17, y: 0, r: 0.2 }), // front body
  Object.freeze({ x: 0.37, y: 0.18, r: 0.16 }), // head
]);

/** Farthest any part of the hitbox reaches from the bird's centre, at any pitch (broad phase). */
export const BIRD_HITBOX_REACH = Math.max(...BIRD_HITBOX.map((c) => Math.hypot(c.x, c.y) + c.r));

export const WORLD = Object.freeze({
  groundY: -3.2,
  /** The bird cannot fly above this. Obstacles hanging from above reach past it. */
  ceilingY: 4.4,
  /** Top of hanging obstacles (well above the visible area). */
  obstacleTopY: 14,
  birdStartY: 0.4,
  baseSpeed: 6.5,
  maxSpeed: 10.5,
  /** Distance over which speed ramps from base to max. */
  speedRampDistance: 1500,
  /** Obstacles are generated this far ahead of the bird (off-screen). */
  spawnAhead: 46,
  /** ...and recycled this far behind it. */
  despawnBehind: 16,
  /** Empty runway before the first obstacle. */
  runway: 12,
  /** Visual depth (z) of obstacles. */
  obstacleDepth: 1.6,
});

export const SCORING = Object.freeze({
  pointsPerMetre: 1,
  /** Tuned so orbs are ~35-40% of a skilled player's score: a bonus, not the main source. */
  orbPoints: 5,
});

export const DYING_DURATION = 1.1; // seconds of crash animation before the game-over screen
