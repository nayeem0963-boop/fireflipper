/**
 * Tunable physics constants. Flight physics is NOT implemented in this
 * pass; these placeholders give the values a single home for when it is.
 * Units: world units (roughly metres) and seconds.
 */
export const PHYSICS = Object.freeze({
  /** Forward scroll speed of the world while running. */
  worldSpeed: 6,
  /** Reserved for the flight model. */
  gravity: -22,
  flapImpulse: 8.5,
  maxFallSpeed: -14,
  /** Fixed simulation timestep (s); render rate stays decoupled. */
  fixedStep: 1 / 120,
  /** Clamp large frame gaps (tab switch, GC hitch) to avoid tunnelling. */
  maxFrameDelta: 1 / 20,
});
