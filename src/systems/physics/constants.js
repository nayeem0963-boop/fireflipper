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
  /** Gravity drops by this fraction at the apex of a climb (a brief, natural hang). */
  apexGravityDrop: 0.16,
  /** |vy| below which the apex hang applies (u/s). */
  apexSpeed: 2.4,
  /** Extra gravity (fraction) once falling freely: release feels weighty, not floaty. */
  fallGravityBoost: 0.12,
  /** Fall speed (u/s) at which the full boost applies. */
  fallBoostSpeed: 4,
  /** Seconds for a dive to build to full strength / to relax after release. */
  diveAttack: 0.16,
  diveRelease: 0.22,
  /** Visual-only spring response of the bird's body (pitch and bank). */
  pitchStiffness: 150,
  pitchDamping: 0.6, // damping ratio; <1 gives a small natural overshoot
  rollStiffness: 90,
  rollDamping: 0.75,
  maxRoll: 0.26,
  rollPerAccel: 0.004,
  accelSmoothing: 8,
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
  /** Gems are rare and only sit on difficult routes. */
  gemPoints: 25,
  /** Flying through the middle of an optional fire ring. */
  ringPoints: 15,
});

export const DYING_DURATION = 1.1; // seconds of crash animation before the game-over screen
