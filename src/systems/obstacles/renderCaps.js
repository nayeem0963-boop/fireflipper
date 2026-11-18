/**
 * How many of each thing the renderers can draw at once (InstancedMesh
 * sizes). Anything beyond a cap would be silently skipped while its collider
 * still exists, so the tests assert the generator never exceeds these.
 * Counts are for the visible window: 20 units behind the bird to 60 ahead.
 */
export const RENDER_CAPS = Object.freeze({
  column: 48,
  block: 48,
  rock: 112,
  boulder: 12,
  geyser: 24,
  spinner: 12,
  ring: 12,
  orb: 64,
  gem: 16,
  shield: 8,
  magnet: 8,
});
