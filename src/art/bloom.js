import { defaultsOf } from './params.js';

/**
 * Bloom settings for the Art Lab. Bloom makes the brightest parts of the picture glow into their surroundings: the scene is
 * drawn into a high-dynamic-range buffer, everything brighter than `threshold` is blurred at several scales, and the blur is
 * added back with `strength`. `radius` is how far it spreads. Pure data (a parameter schema like a piece's), so the HUD builds
 * its sliders from it and the tests can check it without a browser.
 */
export const BLOOM_PARAMS = {
  strength: { type: 'range', label: 'Bloom strength', min: 0, max: 3, step: 0.05, default: 0.8 },
  threshold: { type: 'range', label: 'Bloom threshold', min: 0, max: 1.5, step: 0.05, default: 0.6 },
  radius: { type: 'range', label: 'Bloom radius', min: 0, max: 1, step: 0.05, default: 0.5 },
};

export const BLOOM_DEFAULTS = defaultsOf(BLOOM_PARAMS);

/** Samples for the bloom's own render target (anti-aliasing): the low quality tier goes without, which is much cheaper. */
export const bloomSamples = (quality) => (quality === 'low' ? 0 : 4);
