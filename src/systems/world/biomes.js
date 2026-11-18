/**
 * Scenery zones along the track. Pure data and maths (no three.js), so it is unit-testable and the simulation never
 * needs it: a zone changes only how the world LOOKS. Obstacle layout, collisions, speed and scoring depend on
 * distance alone and are identical everywhere.
 *
 *  - Red Rock Canyon (0 to 1500 m): a sunset over towering red sandstone cliffs, natural arches and a misty canyon, from three
 *    paintings, one for each 500 m (0 to 500, 500 to 1000, 1000 to 1500). The far scenery is the painting; the floor is a dusty,
 *    faceted canyon floor, and red mesas stand at two depths for parallax.
 *  - Frosty Polar (1500 to 2000 m): Glacier Valley (to 1665 m), Crystal Ice Canyon (to 1830 m) and Aurora Lake, from three paintings.
 *  - Celestial Realm (2000 to 3000 m): a night of floating crystal cities among galaxies, a ringed planet and nebulae, from three
 *    cosmic paintings; the view slowly rises from the floating cities up into the cosmos.
 *  - Rose Sky Palace (3000 to 5000 m): a pink-and-gold sunset over white filigree palaces, floating islands with waterfalls and a
 *    mirror-still pool, from three more paintings.
 *  - After 5000 m the original scenery (Ember Valley / Frost Cavern, per theme) shows. (It shows nowhere before that:
 *    the four zones join up, so there is no gap between them.)
 *
 * The Sundarbans and Amazon scenes (and the animal / plant obstacle looks built for them) were retired when the Red Rock Canyon took over
 * the first 1500 m. Their palettes stay in BIOMES below (flagged `retired`, not in the live zone list) because the retired obstacle models,
 * kept in the repo for reuse, are coloured from them. See ACTIVE_OBSTACLE_LOOKS.
 *
 * Changes are gradual. Where two zones meet (1500, 2000 and 3000 m) they cross-fade over CROSSFADE metres centred on the border,
 * so the weights always add up to 1 and the original scenery never flashes in between. The outer edges (the start of the run
 * and 5000 m) fade over FADE metres, so scenery sinks away while the mountains rise instead of popping.
 */
export const FADE = 80;
export const CROSSFADE = 80;

export const BIOMES = Object.freeze({
  sundarbans: Object.freeze({
    retired: true,
    id: 'sundarbans',
    name: 'Sundarbans',
    start: 0,
    end: 500,
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
  canyon: Object.freeze({
    id: 'canyon',
    name: 'Red Rock Canyon',
    start: 0,
    end: 1500,
    joinsNext: true,
    lavaCopy: 'Fell into the canyon',
    orbStyle: 'day',
    /** Orb colours here: a cream core (it reads against the dark shadows) in a deep violet halo (it reads against the bright orange rock). */
    orbs: Object.freeze({ core: '#fff6d8', halo: '#3a0f6a', normal: true }),
    /** Colour of the portrait edge-warning bars here (deep violet on the bright rock). */
    warn: '#2a0a50',
    scene: Object.freeze({
      // Taken from the paintings: red-orange sandstone lit by a low sun, a purple-pink sunset sky, rose mist in the canyon.
      skyTop: '#ac5a5b',
      skyMid: '#dd7d6d',
      skyBottom: '#d18856',
      fog: '#c8705a',
      bg: '#ac5a5b',
      ambient: '#ffd8c0',
      hemiSky: '#f0a080',
      hemiGround: '#8a3a22',
      key: '#ffe0b0',
      floor: '#a8482a',
      floorLight: '#d0683e',
      floorDark: '#6a2814',
      mesa: ['#c85a34', '#a84626', '#e07a4a'],
      /** Deep indigo bodies with cream caps: they read against the orange rock, the purple-pink sky and the dark shadows alike (fairness). */
      column: Object.freeze({ color: '#1a1450', emissive: '#0c0830', cap: '#fff3d0' }),
      block: Object.freeze({ color: '#1a1450', emissive: '#0c0830', cap: '#fff3d0' }),
      /** `rim` is a glowing outline round each floating rock, so it reads against the dark shadows too. */
      rock: Object.freeze({ color: '#1a1450', emissive: '#241a6a', rim: '#fff3d0' }),
      /** What the obstacles are tested against (see biome-test.mjs): the colours the player sees behind them. */
      backdrops: Object.freeze(['#ac5a5b', '#dd7d6d', '#d18856', '#e8785f', '#8d3b22', '#510e00', '#b8614b', '#722718']),
    }),
  }),
  amazon: Object.freeze({
    retired: true,
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
    name: 'Frosty Polar',
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
    joinsNext: true,
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
  palace: Object.freeze({
    id: 'palace',
    name: 'Rose Sky Palace',
    start: 3000,
    end: 5000,
    joinsPrev: true,
    lavaCopy: 'Splashed into the palace pool',
    orbStyle: 'day',
    scene: Object.freeze({
      // Taken from the paintings: a violet-to-pink sunset, a golden horizon, white stone with pink glow, a mirror-still lavender pool.
      skyTop: '#8d729e',
      skyMid: '#cb85a8',
      skyBottom: '#e4b4a3',
      fog: '#c89bb4',
      bg: '#8d729e',
      ambient: '#ffe6ef',
      hemiSky: '#e8a6c8',
      hemiGround: '#a07890',
      key: '#fff0d8',
      pool: '#b48aa8',
      poolLight: '#f2c4d6',
      glow: '#ffe6a8',
      island: '#c9b2c8',
      grass: ['#6a9a50', '#d86a9a', '#e8a0c0'],
      crystal: ['#fff0e0', '#ffd0e0', '#ffe9b0'],
      /** Deep teal bodies with white caps (the colours opposite pink): they read against the pink sky, the white stone, the dark wood and the crimson trees alike. */
      column: Object.freeze({ color: '#0a3f52', emissive: '#052633', cap: '#ffffff' }),
      block: Object.freeze({ color: '#0a3f52', emissive: '#052633', cap: '#ffffff' }),
      /** `rim` is a glowing outline round each floating rock, so it reads against the dark wood and crimson foliage too. */
      rock: Object.freeze({ color: '#0a3f52', emissive: '#0c4a5e', rim: '#ffffff' }),
      /** What the obstacles are tested against (see biome-test.mjs): the colours the player sees behind them. */
      backdrops: Object.freeze(['#8d729e', '#cb85a8', '#e4b4a3', '#fbc5ca', '#bb8b9f', '#552921', '#8a1a3a']),
    }),
  }),
});

const ZONES = Object.freeze([BIOMES.canyon, BIOMES.arctic, BIOMES.celestial, BIOMES.palace]);

/** Zone ids in order (the order lights and fog blend in). */
export const ZONE_IDS = Object.freeze(ZONES.map((z) => z.id));

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

/** One weight per live zone ({ canyon, arctic, celestial, palace }) at a distance. They add up to 1 from the start to 4920 m, then fade to 0 by 5000 m. */
export function biomeWeights(distance) {
  return Object.fromEntries(ZONES.map((z) => [z.id, zoneWeight(z, distance)]));
}

/** The live zone with the greatest weight at a distance (the first one at an exact tie; null when none applies). Used for choices that cannot be blended, like orb style. */
export function dominantZone(distance) {
  let best = null;
  let bw = 0;
  for (const z of ZONES) {
    const w = zoneWeight(z, distance);
    if (w > bw) {
      bw = w;
      best = z;
    }
  }
  return best;
}

/** Combined strength of every zone at a distance: how far the original scenery has been replaced (0 to 1). */
export function zoneStrength(distance) {
  let sum = 0;
  for (const z of ZONES) sum += zoneWeight(z, distance);
  return Math.min(1, sum);
}

/** The zone a distance belongs to (by its border, not its fade), or null for the original scenery. */
export function biomeAt(distance) {
  return ZONES.find((z) => distance >= z.start && distance < z.end) ?? null;
}

/**
 * Obstacle looks with their own shapes (the retired Sundarbans and Amazon animals and plants, and the rock pillars) that the game builds and draws.
 * None are live: the models stay in the repo (components/scene/obstacleStyles.js, animalModels.js) and a look is switched back on by adding its id here
 * and mapping a track range to it in obstacleStyleAt.
 */
export const ACTIVE_OBSTACLE_LOOKS = Object.freeze([]);

/**
 * Which obstacle look applies at a track position: the id of a zone whose obstacles are recoloured ('canyon', 'celestial', 'palace': the original shapes in the
 * zone's own colours) or null (the original look, including the whole Arctic stretch). Decided by the obstacle's own position, so it is the same however the
 * camera sees it.
 */
export function obstacleStyleAt(x) {
  const zone = biomeAt(x);
  if (!zone || zone.id === 'arctic') return null;
  return zone.id;
}
