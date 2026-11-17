/**
 * Biomes: the scenery shifts from Ember Valley to Obsidian Reach as the
 * run goes on. Pure data and helpers (no Three.js) so the progression is
 * testable; the colour mixing lives with the renderer.
 */
export const BIOME_SHIFT = Object.freeze({
  /** Metres at which the scenery starts changing, and at which the change is complete. */
  start: 500,
  end: 700,
});

export const BIOME_NAMES = Object.freeze({ ember: 'Ember Valley', obsidian: 'Obsidian Reach' });

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** 0 = fully Ember Valley, 1 = fully Obsidian Reach (smoothstep over the shift range). */
export function biomeBlendAt(distance) {
  const k = clamp01((distance - BIOME_SHIFT.start) / (BIOME_SHIFT.end - BIOME_SHIFT.start));
  return k * k * (3 - 2 * k);
}

/** Which biome's name to show for a distance: flips at the midpoint of the shift. */
export function biomeIdAt(distance) {
  return biomeBlendAt(distance) >= 0.5 ? 'obsidian' : 'ember';
}
