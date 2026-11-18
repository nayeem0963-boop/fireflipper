/**
 * The journey: five environments laid end to end along the track. Pure data and pure
 * functions (no three.js, no React), so the generator, the renderers and the tests all
 * read the same thing.
 *
 * Nothing is ever a hard cut. Every visual parameter (sky, fog, light, colours, particles,
 * how much of each kind of scenery is standing) is a number that is blended between
 * neighbouring environments over the TRANSITION metres either side of their boundary, so the
 * world changes continuously as you fly. `environmentAt(distance)` returns that blend.
 */

/** Metres either side of a boundary over which one environment melts into the next. */
export const TRANSITION = 70;

const hex = (h) => {
  // sRGB hex -> linear RGB, which is what three.js colour setRGB() expects.
  const n = parseInt(h.slice(1), 16);
  const f = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)];
};

/**
 * Visual and gameplay definition of each environment.
 *
 * `patterns`: which obstacle sections it uses and how often. `w` is the base weight, `g` how
 * much that grows with difficulty, `from` the first distance (metres) it can appear, if later
 * than the environment's start (the opening environment introduces things one at a time).
 */
export const BIOMES = [
  {
    id: 'plains',
    name: 'Volcanic Plains',
    tagline: 'Fire and basalt',
    from: 0,
    patterns: {
      gate: { w: 3, g: -1 },
      column: { w: 2, g: -0.5 },
      floatingRocks: { w: 1.6, from: 80 },
      splitGate: { w: 1.0, g: 0.8, from: 150 },
      formation: { w: 1.2, g: 1, from: 200 },
      geysers: { w: 0.8, g: 0.9, from: 280 },
      passage: { w: 0.6, g: 0.8, from: 400 },
    },
    sky: { top: hex('#0b0907'), mid: hex('#1c0b06'), low: hex('#5a1a08'), hor: hex('#ff8a2a') },
    fog: { color: hex('#120806'), near: 22, far: 75 },
    ambient: { color: hex('#ffb27a'), intensity: 0.3 },
    hemi: { sky: hex('#ff9a4a'), ground: hex('#0a0503'), intensity: 0.7 },
    key: { color: hex('#ffd8b0'), intensity: 1.6 },
    ground: { color: hex('#ffffff'), emissive: hex('#ff6a1a'), emissiveIntensity: 0.45 },
    obstacle: { color: hex('#6b4433'), emissive: hex('#3a1004'), emissiveIntensity: 0.6, cap: hex('#ff8a2a') },
    peak: { a: hex('#1d0c07'), b: hex('#2a1009'), c: hex('#3a160b'), emissive: hex('#3a1206') },
    scenery: { peaks: 1, cliffs: 0, islands: 0, trees: 0, clouds: 0 },
    particles: { color: hex('#ffae4a'), size: 0.13, count: 1, rise: 1, wind: 0 },
    effects: { wind: 0, flicker: 0, storm: 0 },
  },
  {
    id: 'canyon',
    name: 'Rocky Canyon',
    tagline: 'Walls of red stone',
    from: 500,
    patterns: {
      gate: { w: 1.4 },
      column: { w: 1 },
      floatingRocks: { w: 0.6 },
      splitGate: { w: 1.1, g: 0.6 },
      formation: { w: 1.7, g: 0.8 },
      passage: { w: 1.5, g: 0.5 },
      tunnel: { w: 1.5, g: 0.6 },
      boulders: { w: 1.6, g: 0.9 },
      geysers: { w: 0.4 },
    },
    sky: { top: hex('#120b08'), mid: hex('#2a1409'), low: hex('#7a3510'), hor: hex('#e0802a') },
    fog: { color: hex('#1f1109'), near: 22, far: 70 },
    ambient: { color: hex('#ffc088'), intensity: 0.32 },
    hemi: { sky: hex('#ffa860'), ground: hex('#120805'), intensity: 0.68 },
    key: { color: hex('#ffcf9a'), intensity: 1.5 },
    ground: { color: hex('#e8c8b0'), emissive: hex('#d85a14'), emissiveIntensity: 0.3 },
    obstacle: { color: hex('#86563a'), emissive: hex('#3a1a08'), emissiveIntensity: 0.45, cap: hex('#ffb03a') },
    peak: { a: hex('#4a2414'), b: hex('#6a3420'), c: hex('#80452a'), emissive: hex('#5a2a12') },
    scenery: { peaks: 0.2, cliffs: 1, islands: 0, trees: 0, clouds: 0 },
    particles: { color: hex('#d9a066'), size: 0.12, count: 1.1, rise: 0.15, wind: 0.5 },
    effects: { wind: 0.25, flicker: 0, storm: 0 },
  },
  {
    id: 'islands',
    name: 'Floating Islands',
    tagline: 'A dusk sky of broken stone',
    from: 1000,
    patterns: {
      islandChain: { w: 2.4, g: 0.6 },
      floatingRocks: { w: 1.6 },
      splitGate: { w: 1.1, g: 0.6 },
      spinner: { w: 1.5, g: 0.9 },
      gate: { w: 1.2 },
      column: { w: 0.7 },
      geysers: { w: 0.4 },
    },
    sky: { top: hex('#0d0a14'), mid: hex('#2a1424'), low: hex('#8a3a40'), hor: hex('#ffa060') },
    fog: { color: hex('#1a0f1c'), near: 26, far: 82 },
    ambient: { color: hex('#e8a8c0'), intensity: 0.34 },
    hemi: { sky: hex('#ff9a7a'), ground: hex('#1c0a1e'), intensity: 0.7 },
    key: { color: hex('#ffe0c8'), intensity: 1.5 },
    ground: { color: hex('#d8b8e8'), emissive: hex('#c0407a'), emissiveIntensity: 0.3 },
    obstacle: { color: hex('#54405a'), emissive: hex('#2a0f2e'), emissiveIntensity: 0.5, cap: hex('#ffc04a') },
    peak: { a: hex('#1a0c1c'), b: hex('#2a1228'), c: hex('#3a1a34'), emissive: hex('#2a0e2a') },
    scenery: { peaks: 0, cliffs: 0, islands: 1, trees: 0, clouds: 0 },
    particles: { color: hex('#ffc86a'), size: 0.12, count: 0.8, rise: 0.4, wind: 0.2 },
    effects: { wind: 0.3, flicker: 0, storm: 0 },
  },
  {
    id: 'forest',
    name: 'Burning Forest',
    tagline: 'Every tree is a torch',
    from: 1500,
    patterns: {
      grove: { w: 2.6, g: 0.8 },
      column: { w: 1.4 },
      gate: { w: 1.1 },
      geysers: { w: 1.5, g: 0.9 },
      splitGate: { w: 1.1, g: 0.6 },
      tunnel: { w: 0.8 },
      spinner: { w: 0.7, g: 0.6 },
      boulders: { w: 0.5, g: 0.5 },
    },
    sky: { top: hex('#090404'), mid: hex('#260a05'), low: hex('#8a2a0a'), hor: hex('#ff5018') },
    fog: { color: hex('#1a0705'), near: 20, far: 64 },
    ambient: { color: hex('#ff9060'), intensity: 0.34 },
    hemi: { sky: hex('#ff6a30'), ground: hex('#0c0402'), intensity: 0.78 },
    key: { color: hex('#ffa070'), intensity: 1.35 },
    ground: { color: hex('#ffd0b0'), emissive: hex('#ff4a10'), emissiveIntensity: 0.62 },
    obstacle: { color: hex('#46302a'), emissive: hex('#8a2408'), emissiveIntensity: 0.7, cap: hex('#ff5a1c') },
    peak: { a: hex('#1a0806'), b: hex('#280c08'), c: hex('#3a110a'), emissive: hex('#4a1408') },
    scenery: { peaks: 0, cliffs: 0, islands: 0, trees: 1, clouds: 0 },
    particles: { color: hex('#ff7a2a'), size: 0.14, count: 1.7, rise: 1.5, wind: 0.2 },
    effects: { wind: 0.2, flicker: 1, storm: 0 },
  },
  {
    id: 'storm',
    name: 'Ash Storm',
    tagline: 'The sky comes down',
    from: 2000,
    patterns: {
      ashfall: { w: 2.2, g: 0.9 },
      spinner: { w: 1.4, g: 0.8 },
      boulders: { w: 1.0, g: 0.8 },
      tunnel: { w: 1.2, g: 0.6 },
      grove: { w: 1.0 },
      islandChain: { w: 0.9 },
      formation: { w: 1.0 },
      splitGate: { w: 1.2, g: 0.6 },
      gate: { w: 0.9 },
    },
    sky: { top: hex('#0e0c0b'), mid: hex('#342b27'), low: hex('#6e5444'), hor: hex('#c08a62') },
    fog: { color: hex('#2a2321'), near: 16, far: 48 },
    ambient: { color: hex('#d8c4b0'), intensity: 0.42 },
    hemi: { sky: hex('#c8a890'), ground: hex('#14100e'), intensity: 0.7 },
    key: { color: hex('#e0c8b0'), intensity: 1.2 },
    ground: { color: hex('#b8a898'), emissive: hex('#ff6a1a'), emissiveIntensity: 0.2 },
    obstacle: { color: hex('#5c5049'), emissive: hex('#2a1608'), emissiveIntensity: 0.4, cap: hex('#ff9a3a') },
    peak: { a: hex('#1a1614'), b: hex('#26201d'), c: hex('#342c28'), emissive: hex('#241408') },
    scenery: { peaks: 0.3, cliffs: 0, islands: 0, trees: 0, clouds: 1 },
    particles: { color: hex('#e2d6c8'), size: 0.16, count: 2.4, rise: -0.5, wind: 1 },
    effects: { wind: 1, flicker: 0, storm: 1 },
  },
];

/** Boundary distances: the start of each environment after the first. */
export const BOUNDARIES = BIOMES.slice(1).map((b) => b.from);

/** The environment you are "in" at `distance` (switches exactly at the boundary). */
export function biomeIndexAt(distance) {
  let i = 0;
  while (i + 1 < BIOMES.length && distance >= BIOMES[i + 1].from) i++;
  return i;
}

/** First distance (metres) at which a pattern can appear in any environment, or Infinity. */
export function firstAppearance(pattern) {
  let best = Infinity;
  for (const b of BIOMES) {
    const spec = b.patterns[pattern];
    if (spec) best = Math.min(best, spec.from ?? b.from);
  }
  return best;
}

const smooth = (u) => {
  const t = Math.min(1, Math.max(0, u));
  return t * t * (3 - 2 * t);
};

/** Blend factor toward the next environment (0 = fully the current one) and which pair. */
export function blendAt(distance) {
  const i = biomeIndexAt(distance);
  // Approaching the next boundary: start melting TRANSITION metres early.
  if (i + 1 < BIOMES.length) {
    const edge = BIOMES[i + 1].from;
    if (distance > edge - TRANSITION) return { a: i, b: i + 1, t: smooth((distance - (edge - TRANSITION)) / (2 * TRANSITION)) };
  }
  // Just past a boundary: still finishing the melt from the previous one.
  if (i > 0) {
    const edge = BIOMES[i].from;
    if (distance < edge + TRANSITION) return { a: i - 1, b: i, t: smooth((distance - (edge - TRANSITION)) / (2 * TRANSITION)) };
  }
  return { a: i, b: i, t: 0 };
}

const NUMERIC_GROUPS = ['sky', 'fog', 'ambient', 'hemi', 'key', 'ground', 'obstacle', 'peak', 'scenery', 'particles', 'effects'];

function lerpInto(out, a, b, t) {
  for (const k in a) {
    const va = a[k];
    if (Array.isArray(va)) {
      const vb = b[k];
      const o = out[k];
      o[0] = va[0] + (vb[0] - va[0]) * t;
      o[1] = va[1] + (vb[1] - va[1]) * t;
      o[2] = va[2] + (vb[2] - va[2]) * t;
    } else {
      out[k] = va + (b[k] - va) * t;
    }
  }
}

/** A reusable result object with the same shape as a biome's visual data. */
export function createEnvState() {
  const state = { a: 0, b: 0, t: 0, index: 0, distance: -1 };
  for (const g of NUMERIC_GROUPS) {
    state[g] = {};
    for (const k in BIOMES[0][g]) state[g][k] = Array.isArray(BIOMES[0][g][k]) ? [0, 0, 0] : 0;
  }
  return state;
}

/**
 * The blended environment at `distance`, written into `out` (no allocation).
 * Repeated calls with the same distance in one frame are free.
 */
export function environmentAt(distance, out) {
  if (out.distance === distance) return out;
  const { a, b, t } = blendAt(distance);
  out.a = a;
  out.b = b;
  out.t = t;
  out.index = biomeIndexAt(distance);
  out.distance = distance;
  for (const g of NUMERIC_GROUPS) lerpInto(out[g], BIOMES[a][g], BIOMES[b][g], t);
  return out;
}

/** Shared state for the renderers: one blend per frame, however many components read it. */
export const envState = createEnvState();

/**
 * Pattern weights at `distance`: each environment's table, blended across the transition so
 * the mix of obstacles changes gradually too. `t` is difficulty 0..1 (adds the `g` growth).
 */
export function patternWeightsAt(distance, t, out) {
  const { a, b, t: k } = blendAt(distance);
  for (const key in out) out[key] = 0;
  const add = (biome, scale) => {
    if (scale <= 0) return;
    for (const type in biome.patterns) {
      const spec = biome.patterns[type];
      if (distance <= (spec.from ?? biome.from)) continue;
      out[type] = (out[type] || 0) + scale * Math.max(0.05, spec.w + (spec.g || 0) * t);
    }
  };
  add(BIOMES[a], 1 - k);
  if (b !== a) add(BIOMES[b], k);
  return out;
}

/**
 * Budget for the scenery drawn behind the track. The whole backdrop is a fixed number of
 * instanced draw calls whatever environment you are in; layers whose weight is ~0 are not drawn.
 */
export const SCENERY_BUDGET = Object.freeze({
  peakLayers: 3,
  cliffLayers: 2,
  islandLayers: 2,
  treeLayers: 2,
  cloudLayers: 1,
  /** Draw calls per layer kind (core + glow where there is one). */
  drawCallsPerLayer: Object.freeze({ peaks: 1, cliffs: 1, islands: 2, trees: 2, clouds: 1 }),
  /** The most draw calls the backdrop may add at once (two environments blend at most). */
  maxVisibleDrawCalls: 10,
  /** A layer whose weight is below this is not drawn at all. */
  minWeight: 0.02,
});
