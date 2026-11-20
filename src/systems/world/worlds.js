/**
 * The journey: FIVE worlds of 2,000 m each, 10,000 m in all ("Journey to the Celestial City"). This is the ONE place the world borders are written down;
 * the scenery zones (`BIOMES`), the obstacle kits and the biome hazards (`KIT_STARTS`), the painting dissolves, the milestones and the ending all derive from it.
 * Pure data and maths (no three.js, no React): the simulation, the renderers and the headless tests share it.
 *
 * A world's `id` is the scenery zone id (`BIOMES[id]`) and its `kit` is the obstacle kit id (`rockShapes.KITS[kit]`); they differ only for Frosty Polar ('arctic' / 'frosty').
 * The world a distance belongs to depends on the distance alone, so a border is crossed exactly once per run, in order, whatever the frame rate.
 */
export const WORLD_COUNT = 5;
export const WORLD_LENGTH = 2000;
/** The finish line (metres): reaching it completes the journey. */
export const JOURNEY_LENGTH = WORLD_COUNT * WORLD_LENGTH;

const make = (index, id, kit, name) => Object.freeze({ index, id, kit, name, start: index * WORLD_LENGTH, end: (index + 1) * WORLD_LENGTH });

export const WORLDS = Object.freeze([
  make(0, 'canyon', 'canyon', 'Red Rock Canyon'),
  make(1, 'arctic', 'frosty', 'Frosty Polar'),
  make(2, 'celestial', 'celestial', 'Celestial Realm'),
  make(3, 'palace', 'palace', 'Rose Sky Palace'),
  make(4, 'sanctuary', 'sanctuary', 'Cloud Sanctuary'),
]);

/** The index (0 to 4) of the world a distance is in: borders belong to the world that starts there; negative distances are world 0 and the finish line and beyond is the last world. */
export function worldIndexAt(distance) {
  const i = Math.floor(distance / WORLD_LENGTH);
  return i < 0 ? 0 : i >= WORLD_COUNT ? WORLD_COUNT - 1 : i;
}
export const worldAt = (distance) => WORLDS[worldIndexAt(distance)];

/** The milestones: completing world i (reaching its end). The last one is the end of the journey. */
export const MILESTONES = Object.freeze(WORLDS.map((w) => Object.freeze({ index: w.index, at: w.end, world: w.id, name: w.name, final: w.index === WORLD_COUNT - 1 })));

/** How many milestones a distance has reached (0 to 5): the count of worlds completed. */
export function worldsCompleted(distance) {
  return Math.max(0, Math.min(WORLD_COUNT, Math.floor(distance / WORLD_LENGTH)));
}

/** Where painting `i + 1` of a world dissolves in over painting `i`: `count` paintings share the world's length equally. */
export function paintingCuts(worldIndex, count) {
  const w = WORLDS[worldIndex];
  return Array.from({ length: count - 1 }, (_, i) => w.start + ((i + 1) * WORLD_LENGTH) / count);
}

/** The last stretch before the finish line is open sky: no section is built that would end within this many metres of it (the arrival is never fought for). */
export const FINISH_CLEAR = 40;
/** After the finish line the bird glides, untouchable, for the ending (seconds of simulation; the screens use the same figure for their timeline). */
export const GLIDE_SECONDS = 7;

/** Metres before a painting is needed that it starts to load (it must never be missing when it appears). */
export const PRELOAD_LEAD = 150;
