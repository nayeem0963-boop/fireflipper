/**
 * Scenery zones along the track. Pure data and maths (no three.js), so it is unit-testable and the simulation never
 * needs it: a zone changes only how the world LOOKS. Obstacle layout, collisions, speed and scoring depend on
 * distance alone and are identical everywhere.
 *
 *  - Sundarbans (0 to 500 m): the Bengal mangrove delta, after the Sundarbans scene in the Bulbuli project: pale teal
 *    sky, faceted mangrove canopies on stilt roots, brown mud banks, tidal water, pneumatophore (breathing-root) spikes.
 *  - Amazon (1000 to 1500 m): the Amazon rainforest, after the Amazon scene in the Bulbuli project: tall slender
 *    trunks with buttress roots, dense leafy crowns, a leaf-litter floor, ferns, hanging vines and light shafts.
 *  - Everywhere else the original scenery (Ember Valley / Frost Cavern, per theme) shows.
 *
 * Changes are gradual: a zone is full strength inside it and fades over the last/first FADE metres at its edges (the
 * first zone has no fade-in because the run starts in it), so scenery sinks away while the mountains rise instead of popping.
 */
export const SUNDARBANS_END = 500;
export const FADE = 80;
export const FADE_START = SUNDARBANS_END - FADE;

export const BIOMES = Object.freeze({
  sundarbans: Object.freeze({
    id: 'sundarbans',
    name: 'Sundarbans',
    start: 0,
    end: SUNDARBANS_END,
    /** Game-over wording for falling into the floor here (the simulation's cause code stays 'lava'). */
    lavaCopy: 'Fell into the tidal creek',
    /** Orb halo style: 'day' uses a saturated normal-blended halo (an additive glow washes out on a pale background). */
    orbStyle: 'day',
    scene: Object.freeze({
      skyTop: '#8fcfd0',
      skyBottom: '#eaf6ea',
      fog: '#d3e8dc',
      bg: '#bfe0d2',
      ambient: '#e6f6ea',
      hemiSky: '#a8dcd2',
      hemiGround: '#3a2e20',
      key: '#fff3d6',
      water: '#6f9d86',
      waterLight: '#9cc7ae',
      mud: '#79644e',
      mudDark: '#4d3d2e',
      bark: '#5a3d2a',
      root: '#4a3222',
      canopy: ['#2f6b3a', '#245a30', '#3b7d44', '#1f4f2c'],
      /** Dark bark bodies with bright moss / plank caps: between them they read against sky, water and canopy (fairness). */
      column: Object.freeze({ color: '#6b4a30', emissive: '#2a1c10', cap: '#c4f27a' }),
      block: Object.freeze({ color: '#7a5538', emissive: '#2a1c10', cap: '#ffe58a' }),
      rock: Object.freeze({ color: '#9a7a52', emissive: '#2a2014' }),
    }),
  }),
  amazon: Object.freeze({
    id: 'amazon',
    name: 'Amazon',
    start: 1000,
    end: 1500,
    lavaCopy: 'Fell to the forest floor',
    orbStyle: 'night',
    scene: Object.freeze({
      skyTop: '#2c7a68',
      skyBottom: '#4a9478',
      fog: '#2f5f48',
      bg: '#244a38',
      ambient: '#d4ecc8',
      hemiSky: '#7fc4a8',
      hemiGround: '#2a2018',
      key: '#ffe9b8',
      floor: '#5b4a33',
      floorDark: '#3d3022',
      leafLitter: ['#7a6a3a', '#8a5a2a', '#4f7a34', '#a08a4a'],
      bark: '#4a3322',
      bough: '#5a3d2a',
      leaf: ['#2f6b2f', '#2a5e2a', '#3b7a34', '#25552a'],
      vine: '#4f8a3a',
      shaft: '#fff2b0',
      /** Sunlit wood and bright caps, lighter than the dark trunks and leaves behind (fairness). */
      column: Object.freeze({ color: '#c9974e', emissive: '#3a2a14', cap: '#fff08a' }),
      block: Object.freeze({ color: '#b07a44', emissive: '#3a2a14', cap: '#ffc24a' }),
      rock: Object.freeze({ color: '#b8a67c', emissive: '#2a2414' }),
    }),
  }),
});

const ZONES = Object.freeze([BIOMES.sundarbans, BIOMES.amazon]);

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * How strongly a zone's look applies at a distance (metres): 0 outside the zone, 1 inside, easing over FADE metres at
 * the edges. The first zone (start 0) has no fade-in.
 */
export function zoneWeight(zone, distance) {
  const fadeIn = zone.start > 0 ? smoothstep(zone.start, zone.start + FADE, distance) : 1;
  const fadeOut = 1 - smoothstep(zone.end - FADE, zone.end, distance);
  return distance < zone.start || distance >= zone.end ? 0 : Math.min(fadeIn, fadeOut);
}

/** Sundarbans weight (kept for the original callers): 1 up to 420 m, 0 from 500 m on. */
export function biomeWeight(distance) {
  return distance >= SUNDARBANS_END ? 0 : zoneWeight(BIOMES.sundarbans, distance);
}

/** { sundarbans, amazon } weights at a distance. At most one is non-zero (the zones do not overlap). */
export function biomeWeights(distance) {
  return { sundarbans: zoneWeight(BIOMES.sundarbans, distance), amazon: zoneWeight(BIOMES.amazon, distance) };
}

/** Combined strength of every zone at a distance: how far the original scenery has been replaced (0 to 1). */
export function zoneStrength(distance) {
  const w = biomeWeights(distance);
  return Math.max(w.sundarbans, w.amazon);
}

/** The zone a distance belongs to, or null for the original scenery. */
export function biomeAt(distance) {
  return ZONES.find((z) => distance >= z.start && distance < z.end) ?? null;
}
