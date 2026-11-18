/**
 * Scenery zones along the track. Pure data and maths (no three.js), so it is unit-testable and the simulation never
 * needs it: a zone changes only how the world LOOKS. Obstacle layout, collisions, speed and scoring depend on
 * distance alone and are identical everywhere.
 *
 *  - Sundarbans (0 to 500 m): the Bengal mangrove delta, after the Sundarbans scene in the Bulbuli project: pale teal
 *    sky, faceted mangrove canopies on stilt roots, brown mud banks, tidal water, pneumatophore (breathing-root) spikes.
 *  - After 500 m the original scenery (Ember Valley / Frost Cavern, per theme) takes over.
 *
 * The change is gradual: the Sundarbans look is full strength until FADE_START and gone at SUNDARBANS_END, so the
 * mangroves sink away while the mountains rise instead of the scenery popping.
 */
export const SUNDARBANS_END = 500;
export const FADE_START = 420;

export const BIOMES = Object.freeze({
  sundarbans: Object.freeze({
    id: 'sundarbans',
    name: 'Sundarbans',
    start: 0,
    end: SUNDARBANS_END,
    /** Game-over wording for falling into the floor here (the simulation's cause code stays 'lava'). */
    lavaCopy: 'Fell into the tidal creek',
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
});

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How strongly the Sundarbans look applies at a distance (metres): 1 up to FADE_START, 0 from SUNDARBANS_END on. */
export function biomeWeight(distance) {
  return 1 - smoothstep(FADE_START, SUNDARBANS_END, distance);
}

/** The zone a distance belongs to, or null for the original scenery. */
export function biomeAt(distance) {
  return distance < SUNDARBANS_END ? BIOMES.sundarbans : null;
}
