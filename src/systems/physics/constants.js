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
  /** Collision radius of the bird. Slightly smaller than the visual for fairness. */
  birdRadius: 0.36,
  /** Fixed simulation timestep (s). Rendering interpolates between steps. */
  fixedStep: 1 / 120,
  /** Clamp long frames (tab switch, GC hitch) so the sim never takes huge leaps. */
  maxFrameDelta: 1 / 15,
});

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
  /** Squeezing past an obstacle closer than this (surface to bird edge, in units) is a near miss. */
  nearMissMargin: 0.28,
  /** Base bonus for a near miss; multiplied by the current streak (capped). */
  nearMissPoints: 3,
  /** A streak survives this long (seconds) without another near miss. */
  streakWindow: 4,
  maxStreakMultiplier: 5,
});

export const POWERUPS = Object.freeze({
  /** Pickup types and their relative spawn weights. */
  types: Object.freeze({ shield: 3, magnet: 2.5, slow: 2 }),
  /** Chance that a section is preceded by a power-up, once past minDistance. */
  chance: 0.13,
  minDistance: 120,
  pickupRadius: 0.45,
  magnetDuration: 8,
  magnetRange: 4.5,
  magnetSpeed: 15,
  slowDuration: 5,
  slowFactor: 0.7,
  /** Grace period after a shield absorbs a hit, so the bird can clear the obstacle. */
  invulnDuration: 1.1,
});

/** Air currents: vertical push (units/s², added to gravity) inside a wind zone. */
export const WIND = Object.freeze({
  updraft: 30,
  downdraft: -10,
  /** An updraft only lifts the bird up to this climb speed (flaps can still go faster). */
  liftCap: 4.5,
  /** A downdraft pulls a little faster than normal terminal fall speed, but not without limit. */
  fallCap: -13.5,
});

export const DYING_DURATION = 1.1; // seconds of crash animation before the game-over screen
