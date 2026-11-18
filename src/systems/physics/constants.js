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

/**
 * Scoring. Distance is always worth pointsPerMetre and is NEVER multiplied: surviving is the
 * backbone of every score. Everything else is a bonus, worth its base value times the current
 * streak multiplier at the moment it is earned.
 */
export const SCORING = Object.freeze({
  pointsPerMetre: 1,
  orbPoints: 2,
  /** Gems are rare, only sit on risky routes, and are banked as currency as well. */
  gemPoints: 12,
  /** Flying through the middle of an optional fire ring. */
  ringPoints: 8,
  /** A near miss pays between these, by how tight it was. */
  nearMissMin: 2,
  nearMissMax: 5,
  /** A second shield picked up while one is held. Flat: never multiplied. */
  shieldDuplicate: 10,
});

/**
 * Orb streak. Every orb, gem or fire ring collected adds 1 and restarts a timer. If the timer runs
 * out before the next one, or a shield takes a hit for you, the streak ends and the multiplier
 * drops back to x1. Tiers: the multiplier is the highest `mult` whose `at` the streak has reached.
 */
export const STREAK = Object.freeze({
  window: 2.6, // seconds allowed between collections
  tiers: Object.freeze([
    Object.freeze({ at: 0, mult: 1 }),
    Object.freeze({ at: 5, mult: 2 }),
    Object.freeze({ at: 14, mult: 3 }),
    Object.freeze({ at: 28, mult: 4 }),
    Object.freeze({ at: 45, mult: 5 }),
  ]),
});

export const POWERUPS = Object.freeze({
  /** After a shield absorbs a hit, collisions are ignored for this long so the bird can get clear. */
  shieldGrace: 1.5,
  /** Magnet: how long it lasts and how far away it pulls orbs. */
  magnetTime: 8,
  magnetRadius: 3.4,
  /** Pull speed (units/s) at the edge and at the centre of the field. */
  magnetPullFar: 7,
  magnetPullNear: 16,
  /** Roughly how far apart (m) power-ups are placed along the track. */
  spacingMin: 260,
  spacingMax: 420,
  firstAt: 150,
});

export const DYING_DURATION = 1.1; // seconds of crash animation before the game-over screen
