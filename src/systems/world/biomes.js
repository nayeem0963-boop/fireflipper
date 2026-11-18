/**
 * Scenery zones along the track. Pure data and maths (no three.js), so it is unit-testable and the simulation never
 * needs it: a zone changes only how the world LOOKS. Obstacle layout, collisions, speed and scoring depend on
 * distance alone and are identical everywhere.
 *
 *  - Sundarbans (0 to 500 m): the Bengal mangrove delta, after the Sundarbans scene in the Bulbuli project: pale teal
 *    sky, faceted mangrove canopies on stilt roots, brown mud banks, tidal water, pneumatophore (breathing-root) spikes.
 *  - Amazon (1000 to 1500 m): the Amazon rainforest, after the Amazon scene in the Bulbuli project: tall slender
 *    trunks with buttress roots, dense leafy crowns, a leaf-litter floor, ferns, hanging vines and light shafts.
 *  - Volcanic Coast (500 to 1000 m): a pale teal sea under a peach horizon, with an erupting volcano and its boulder island,
 *    a snow-capped range and sandstone buttes on a sandy shore. The far scenery is the three coast paintings (public/images/backdrop,
 *    cropped to their horizon band and blended along the track); the water, shore and rock islands are drawn in 3D.
 *  - Arctic Ice Shelf (1500 to 2000 m): a pale ice shelf and snowfield under an aurora and a peach horizon, from three more paintings.
 *  - Celestial Realm (2000 to 3000 m): a night of floating crystal cities among galaxies, a ringed planet and nebulae, from three
 *    cosmic paintings; the view slowly rises from the floating cities up into the cosmos.
 *  - After 3000 m the original scenery (Ember Valley / Frost Cavern, per theme) shows. (It shows nowhere before that:
 *    the five zones join up, so there is no gap between them.)
 *
 * Changes are gradual. Where two zones meet (500, 1000, 1500 and 2000 m) they cross-fade over CROSSFADE metres centred on the border,
 * so the weights always add up to 1 and the original scenery never flashes in between. The outer edges (the start of the run
 * and 3000 m) fade over FADE metres, so scenery sinks away while the mountains rise instead of popping.
 */
export const SUNDARBANS_END = 500;
export const FADE = 80;
export const CROSSFADE = 80;
export const FADE_START = SUNDARBANS_END - CROSSFADE / 2;

export const BIOMES = Object.freeze({
  sundarbans: Object.freeze({
    id: 'sundarbans',
    name: 'Sundarbans',
    start: 0,
    end: SUNDARBANS_END,
    joinsNext: true,
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
  volcano: Object.freeze({
    id: 'volcano',
    name: 'Volcanic Coast',
    start: 500,
    end: 1000,
    joinsPrev: true,
    joinsNext: true,
    lavaCopy: 'Splashed into the sea',
    orbStyle: 'day',
    scene: Object.freeze({
      // Taken from the paintings: the sky runs from pale teal to a peach horizon; the sea is a muted jade; the shore is warm sand.
      skyTop: '#afdad9',
      skyMid: '#d8e0d4',
      skyBottom: '#f0dccd',
      fog: '#c9dccf',
      bg: '#c9dccf',
      ambient: '#f3efe4',
      hemiSky: '#b4dcd8',
      hemiGround: '#7a6a58',
      key: '#fff0d6',
      water: '#8db4a2',
      waterDeep: '#7a9f8e',
      sand: '#d6a56f',
      sandDark: '#bf8f5c',
      rock: ['#c69a84', '#bd9a85', '#8d8a82'],
      volcano: '#8a6a58',
      lava: '#ff5a3c',
      snow: '#e9eff0',
      butte: ['#d19a64', '#bd8750'],
      /** What the obstacles are tested against (see biome-test.mjs): the colours the player sees behind them. */
      backdrops: Object.freeze(['#afdad9', '#d8e0d4', '#f0dccd', '#8db4a2', '#d6a56f', '#bd9a85', '#8a6a58', '#e9eff0']),
    }),
  }),
  amazon: Object.freeze({
    id: 'amazon',
    name: 'Amazon',
    start: 1000,
    end: 1500,
    joinsPrev: true,
    joinsNext: true,
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
  arctic: Object.freeze({
    id: 'arctic',
    name: 'Arctic Ice Shelf',
    start: 1500,
    end: 2000,
    joinsPrev: true,
    joinsNext: true,
    lavaCopy: 'Fell through the ice',
    orbStyle: 'day',
    scene: Object.freeze({
      // Taken from the paintings: cyan sky with aurora curtains, a peach glow at the horizon, white-blue ice and snow.
      skyTop: '#bbecf2',
      skyMid: '#cfd9da',
      skyBottom: '#ecdccf',
      fog: '#d3e3ea',
      bg: '#bbecf2',
      ambient: '#eef6fa',
      hemiSky: '#bfe4ee',
      hemiGround: '#9ab4c0',
      key: '#fff4e6',
      snow: '#d2e4ed',
      snowMid: '#c0d6e0',
      snowShadow: '#9ebdcb',
      ice: '#b6c3c9',
      rock: ['#7d8d96', '#6f7f88', '#93a3ab'],
      tent: ['#e8742a', '#c8452a'],
      flag: '#d8452a',
      /** What the obstacles are tested against (see biome-test.mjs): the colours the player sees behind them. */
      backdrops: Object.freeze(['#bbecf2', '#cfd9da', '#ecdccf', '#d2e4ed', '#9ebdcb', '#b6c3c9', '#6f7f88']),
    }),
  }),
  celestial: Object.freeze({
    id: 'celestial',
    name: 'Celestial Realm',
    start: 2000,
    end: 3000,
    joinsPrev: true,
    lavaCopy: 'Fell through the clouds',
    orbStyle: 'night',
    scene: Object.freeze({
      // Taken from the paintings: a deep blue-violet night, pastel nebulae, glowing crystal spires.
      skyTop: '#323b5c',
      skyBottom: '#4a5576',
      fog: '#3e4870',
      bg: '#323b5c',
      ambient: '#c6c2ff',
      hemiSky: '#8fa0ff',
      hemiGround: '#2a2050',
      key: '#ffe8d4',
      floor: '#1b2150',
      floorMist: '#4a4f8a',
      stars: ['#ffffff', '#bff4ff', '#ffd6f0', '#fff0b8'],
      /** Dark indigo bodies with glowing cyan caps: between the two they read against the black void, the pastel nebulae and the pale crystal spires (fairness). */
      column: Object.freeze({ color: '#241c4a', emissive: '#150f33', cap: '#7af0ff' }),
      block: Object.freeze({ color: '#241c4a', emissive: '#150f33', cap: '#7af0ff' }),
      /** `rim` is the colour of the glowing outline drawn round a floating rock here, so it reads against the dark void as well as the pale spires. */
      rock: Object.freeze({ color: '#241c4a', emissive: '#2a1a5a', rim: '#7af0ff' }),
      island: '#8c8cc0',
      grass: ['#5ed0b8', '#c27ae0', '#6a9af0'],
      crystal: ['#cfe0ff', '#f0c8ff', '#bff4ff'],
      /** What the obstacles are tested against (see biome-test.mjs): the colours the player sees behind them. */
      backdrops: Object.freeze(['#26314d', '#5b6685', '#cfd1d9', '#73a6b4', '#5b5480', '#e7dae2', '#c4d2e2', '#4c556c']),
    }),
  }),
});

const ZONES = Object.freeze([BIOMES.sundarbans, BIOMES.volcano, BIOMES.amazon, BIOMES.arctic, BIOMES.celestial]);

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * How strongly a zone's look applies at a distance (metres), from 0 to 1.
 *  - Where a zone meets its neighbour (`joinsPrev` / `joinsNext`) the two cross-fade over CROSSFADE metres centred on the border,
 *    so their weights add up to exactly 1 through the handover.
 *  - At an outer edge it eases over FADE metres, inside the zone (the first zone has no fade-in: the run starts in it).
 */
export function zoneWeight(zone, distance) {
  const h = CROSSFADE / 2;
  const fadeIn = zone.start === 0 ? 1 : zone.joinsPrev ? smoothstep(zone.start - h, zone.start + h, distance) : smoothstep(zone.start, zone.start + FADE, distance);
  const fadeOut = zone.joinsNext ? 1 - smoothstep(zone.end - h, zone.end + h, distance) : 1 - smoothstep(zone.end - FADE, zone.end, distance);
  return Math.min(fadeIn, fadeOut);
}

/** Sundarbans weight (kept for the original callers). */
export function biomeWeight(distance) {
  return zoneWeight(BIOMES.sundarbans, distance);
}

/** { sundarbans, volcano, amazon, arctic, celestial } weights at a distance. They add up to 1 from the start to 2920 m, then fade to 0 by 3000 m. */
export function biomeWeights(distance) {
  return {
    sundarbans: zoneWeight(BIOMES.sundarbans, distance),
    volcano: zoneWeight(BIOMES.volcano, distance),
    amazon: zoneWeight(BIOMES.amazon, distance),
    arctic: zoneWeight(BIOMES.arctic, distance),
    celestial: zoneWeight(BIOMES.celestial, distance),
  };
}

/** Combined strength of every zone at a distance: how far the original scenery has been replaced (0 to 1). */
export function zoneStrength(distance) {
  const w = biomeWeights(distance);
  return Math.min(1, w.sundarbans + w.volcano + w.amazon + w.arctic + w.celestial);
}

/** The zone a distance belongs to (by its border, not its fade), or null for the original scenery. */
export function biomeAt(distance) {
  return ZONES.find((z) => distance >= z.start && distance < z.end) ?? null;
}

/**
 * The Volcanic Coast stretch (500 to 1000 m). Its poles are drawn as rock pillars (an obstacle look only: see obstacleStyleAt);
 * its slabs and floating rocks keep the original look.
 */
export const ROCK_RANGE = Object.freeze({ id: 'rock', start: BIOMES.volcano.start, end: BIOMES.volcano.end });

/**
 * Which obstacle look applies at a track position: 'sundarbans', 'amazon', 'rock' (poles only, 500 to 1000 m) or null
 * (the original look, including the Arctic stretch). 'celestial' is the original shapes in the realm's own colours. Decided by the obstacle's own position, so it is the same however the camera sees it.
 */
export function obstacleStyleAt(x) {
  const zone = biomeAt(x);
  if (!zone) return null;
  if (zone.id === 'volcano') return ROCK_RANGE.id;
  return zone.id === 'arctic' ? null : zone.id; // the Arctic keeps the original obstacles; the Celestial Realm recolours them (see ObstacleField)
}
