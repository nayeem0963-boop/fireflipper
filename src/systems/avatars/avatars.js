import { SKINS, colorUnlockScore, isUnlocked } from '../skins/skins.js';
import { DEFAULT_THEME, getTheme } from '../theme/themes.js';

/**
 * Every bird the player can fly as: seven species, each in three colours (Fire, Blue and White), so 21 avatars.
 * A species is named for what it is (never for its colour); the colour is chosen separately.
 *
 * Each avatar carries its species' fields plus `species` (the species id), `color` ('fire' | 'blue' | 'white'),
 * `colorName`, and that colour's `palette`. Its `id` is `<species>-<color>`; that is what is saved as the choice.
 *
 * Three kinds of species:
 *  - 'firebird': the original Fire Flipper bird (unlocked colour by colour by best score; see skins.js).
 *  - 'bird': a code-built bird from the Bulbuli project (Bulbuli the red-whiskered bulbul), with real wing beats.
 *    No model file and no third-party licence: it is built from primitives. `form` says which ('bulbuli').
 *  - 'model': a real 3D bird model re-lit as a fire bird at run time (colour-tinted plumage, glow and a flame
 *    tail). The models are third-party (CC BY 4.0); credits are in credits.js and shown in the app. They are
 *    free to choose: the choice is cosmetic and changes nothing about the physics or the collision size.
 *
 * Model transform fields (units: the Firebird's own local size, so a model fits where the Firebird does):
 *  - file:    path under public/models/birds
 *  - facing:  rotation about the vertical axis (radians) that turns the model's beak toward +X
 *  - pitch:   extra tilt (radians, positive = nose up) to level the body in flight
 *  - length:  size of the silhouette the camera sees (its larger side), after turning and pitching
 *  - lift:    vertical offset after centring
 *  - palette: low / mid / high flame colours, glow colour, how strongly the flame replaces the original plumage
 *             (mix), glow strength, and a floor for how dark the original plumage may be (lumFloor), so black
 *             feathers still catch fire. The base palette here is the Fire version; Blue and White are made
 *             below (see `modelVariants`).
 */
const MODEL_BASE = Object.freeze([
  {
    id: 'scarlet-macaw',
    name: 'Scarlet Macaw',
    tagline: 'A macaw trailing a ribbon of flame',
    file: 'scarlet-macaw.glb',
    facing: Math.PI / 2,
    pitch: 0,
    length: 2.0,
    lift: 0,
    // Wing beats (fractions of the half wingspan): the wing bends from the shoulder outward.
    flap: { start: 0.2, full: 0.5, hingeFrac: 0.4, strength: 0.8 },
    // Eyes (model units from the model's centre): `at` is one eye's centre, mirrored for the other.
    eye: { at: [0.036, 0.075, 0.23], size: 0.014 },
    palette: {
      low: '#a3120a',
      mid: '#ff5a14',
      high: '#ffd36b',
      glow: '#ff7a2a',
      mix: 0.85,
      glowStrength: 0.9,
      lumFloor: 0.2,
    },
  },
  {
    id: 'macaw-flying',
    name: 'Rainbow Macaw',
    tagline: 'A painted macaw in full flight',
    file: 'macaw-flying.glb',
    facing: Math.PI / 2,
    pitch: -0.35,
    length: 2.4,
    lift: 0,
    // Wing beats (fractions of the half wingspan): the wing bends from the shoulder outward.
    flap: { start: 0.2, full: 0.5, hingeFrac: 0.4, strength: 0.8 },
    // Eyes (model units from the model's centre): `at` is one eye's centre, mirrored for the other.
    eye: { at: [0.034, 0.2, 0.18], size: 0.017 },
    palette: {
      low: '#b01540',
      mid: '#ff7a1a',
      high: '#ffb040',
      glow: '#ff6a3a',
      // Keep most of the painted red, yellow and blue feathers (it is a rainbow macaw); the flame tints and lights them.
      mix: 0.25,
      glowStrength: 0.35,
      lumFloor: 0.15,
    },
  },
  {
    id: 'macaw-blue-yellow',
    name: 'Blue-and-Yellow Macaw',
    tagline: 'A big-hearted macaw, wings spread wide',
    file: 'macaw-blue-yellow.glb',
    facing: Math.PI / 2,
    pitch: -0.25,
    length: 2.0,
    lift: 0,
    // Wing beats (fractions of the half wingspan): the wing bends from the shoulder outward.
    flap: { start: 0.2, full: 0.5, hingeFrac: 0.4, strength: 0.8 },
    // Eyes (model units from the model's centre): `at` is one eye's centre, mirrored for the other.
    eye: { at: [0.05, 0.035, 0.3], size: 0.02 },
    palette: {
      low: '#0b3fb8',
      mid: '#2ea6ff',
      high: '#d8f6ff',
      glow: '#3aa8ff',
      mix: 0.85,
      glowStrength: 1,
      lumFloor: 0.2,
    },
  },
  {
    id: 'toco-toucan',
    name: 'Toco Toucan',
    tagline: 'A toucan with a glowing coal of a beak',
    file: 'toco-toucan.glb',
    facing: Math.PI / 2,
    pitch: 0,
    length: 2.0,
    lift: 0,
    // Wing beats (fractions of the half wingspan): the wing bends from the shoulder outward.
    flap: { start: 0.25, full: 0.6, hingeFrac: 0.4, strength: 0.8 },
    // Eyes (model units from the model's centre): `at` is one eye's centre, mirrored for the other.
    eye: { at: [0.05, 0.1, 0.13], size: 0.016 },
    palette: {
      low: '#5a0a06',
      mid: '#e0361a',
      high: '#ffb33a',
      glow: '#ff5a1a',
      mix: 0.9,
      glowStrength: 1,
      lumFloor: 0.35,
    },
  },
  {
    id: 'morpho',
    name: 'Morpho Butterfly',
    tagline: 'A butterfly whose wings beat like flame',
    form: 'butterfly',
    file: 'morpho.glb',
    // The model's head is at its -z end and its body is tilted about 39 degrees nose-up in the resting pose.
    facing: -Math.PI / 2,
    pitch: -0.67,
    length: 4.0,
    lift: 0,
    // Butterfly wings beat for real: how far the stroke swings them, and the height of the hinge along the body.
    beat: 0.9,
    // Where the wings meet the body, and the turn that lines a frame's z axis up with the (tilted) body.
    hingePoint: [0, 0.054, -0.031],
    hingeTilt: -2.46,
    roll: 0.6,
    // Eyes (model units from the model's centre): `at` is one eye's centre, mirrored for the other.
    eye: { at: [0.016, -0.008, -0.11], size: 0.004 },
    palette: {
      low: '#a3120a',
      mid: '#ff5a14',
      high: '#ffd36b',
      glow: '#ff7a2a',
      // Let the wing's veins, dark borders and eye-spots show through the flame.
      mix: 0.7,
      glowStrength: 0.8,
      lumFloor: 0.05,
    },
  },
]);

/** Colour presets for the model birds. Fire is each model's own palette; Blue and White are shared. */
const FIRE_ORANGE = {
  low: '#a3120a',
  mid: '#ff5a14',
  high: '#ffd36b',
  glow: '#ff7a2a',
  mix: 0.85,
  glowStrength: 0.9,
  lumFloor: 0.2,
};
const BLUE = {
  low: '#0b3fb8',
  mid: '#2ea6ff',
  high: '#d8f6ff',
  glow: '#3aa8ff',
  mix: 0.85,
  glowStrength: 1,
  lumFloor: 0.2,
};
const WHITE = {
  low: '#8fa3c4',
  mid: '#e6edf8',
  high: '#ffffff',
  glow: '#cfe4ff',
  mix: 0.9,
  glowStrength: 0.6,
  lumFloor: 0.35,
};
/** Per-species exceptions: a model whose own colours are blue starts as Blue, and the morpho keeps its real wings. */
const VARIANT_OVERRIDES = {
  'macaw-blue-yellow': { fire: FIRE_ORANGE },
  morpho: {
    // Its real wing is iridescent blue and its markings are the point, so the texture shows through strongly.
    blue: {
      low: '#0a2f8f',
      mid: '#2e8cff',
      high: '#aee6ff',
      glow: '#3aa8ff',
      mix: 0.3,
      glowStrength: 0.7,
      lumFloor: 0.1,
    },
    white: { ...WHITE, mix: 0.75, lumFloor: 0.4 },
  },
};

/** The Fire, Blue and White palettes of a model species. */
function modelVariants(m) {
  const o = VARIANT_OVERRIDES[m.id] ?? {};
  return {
    fire: o.fire ?? m.palette,
    blue: o.blue ?? (o.fire ? m.palette : BLUE),
    white: o.white ?? WHITE,
  };
}

/** The model species: each with its three colour palettes (`variants`); `palette` is the Fire one. */
export const MODEL_BIRDS = Object.freeze(
  MODEL_BASE.map((m) => {
    const variants = modelVariants(m);
    return { ...m, palette: variants.fire, variants };
  }),
);

/** Bulbuli the red-whiskered bulbul, in three colours. */
const BULBULI_SPECIES = {
  id: 'bulbuli',
  name: 'Bulbuli',
  tagline: 'The red-whiskered bulbul, crest alight',
  form: 'bulbuli',
  length: 1.9,
  variants: {
    fire: {
      body: '#3a1410',
      wing: '#6a1c10',
      belly: '#ffe9c4',
      crest: '#ff5a14',
      cheek: '#ff2e1a',
      accent: '#ff9a2e',
      beak: '#ffb347',
      glow: '#ff6a2a',
      low: '#a3120a',
      mid: '#ff5a14',
      high: '#ffd36b',
    },
    blue: {
      body: '#0d2a5c',
      wing: '#14407f',
      belly: '#e8fbff',
      crest: '#3aa8ff',
      cheek: '#7ad8ff',
      accent: '#9fe8ff',
      beak: '#d8f6ff',
      glow: '#3aa8ff',
      low: '#0b3fb8',
      mid: '#2ea6ff',
      high: '#d8f6ff',
    },
    white: {
      body: '#b4c0d6',
      wing: '#e6edf8',
      belly: '#ffffff',
      crest: '#dcebff',
      cheek: '#8fc4ff',
      accent: '#f0f6ff',
      beak: '#ffe9a8',
      glow: '#cfe4ff',
      low: '#8fa3c4',
      mid: '#e6edf8',
      high: '#ffffff',
    },
  },
};

/** The three colours every species comes in, in the order the picker shows them. */
export const COLOURS = Object.freeze([
  { id: 'fire', name: 'Fire' },
  { id: 'blue', name: 'Blue' },
  { id: 'white', name: 'White' },
]);

/**
 * Cosmetic trail colours: three stops from the bird's head to the end of its trail, plus a spark colour and a
 * style ('flame' | 'sparks' | 'shimmer', which only changes how the trail looks). Each species has its own Fire
 * trail; Blue and White share cool ramps. Purely visual: a trail has no collision and changes nothing in play.
 */
const FIRE_TRAILS = {
  flipper: { stops: ['#fff1c9', '#ff8a1f', '#d9370b'], spark: '#ffd36b', style: 'flame' },
  bulbuli: { stops: ['#ffb347', '#ff2e1a', '#7a0d08'], spark: '#ff9a2e', style: 'sparks' },
  'scarlet-macaw': { stops: ['#ffe08a', '#ff3b2a', '#8f1f06'], spark: '#ffd36b', style: 'flame' },
  'macaw-flying': { stops: ['#ffe14a', '#ff4a8a', '#3a7bff'], spark: '#7dffb0', style: 'shimmer' },
  'macaw-blue-yellow': { stops: ['#ffe14a', '#2ea6ff', '#0b3fb8'], spark: '#d8f6ff', style: 'flame' },
  'toco-toucan': { stops: ['#ffd36b', '#e0361a', '#5a0a06'], spark: '#ffb33a', style: 'sparks' },
  morpho: { stops: ['#ffe9a8', '#ff7a3a', '#b21e6a'], spark: '#ffb3e0', style: 'shimmer' },
};
const COOL_TRAILS = {
  blue: { stops: ['#e8fbff', '#2ea6ff', '#0b3fb8'], spark: '#9fe8ff' },
  white: { stops: ['#ffffff', '#cfe4ff', '#8fa3c4'], spark: '#ffffff' },
};

function trailFor(speciesId, colorId) {
  const fire = FIRE_TRAILS[speciesId];
  const cool = COOL_TRAILS[colorId];
  return Object.freeze(cool ? { ...cool, style: fire.style } : { ...fire });
}

/** The original bird as a species: its colours come from skins.js (which also holds their unlock scores). */
const FLIPPER_SPECIES = {
  id: 'flipper',
  name: 'Flipper',
  tagline: 'The original flyer, light on its wings',
  kind: 'firebird',
};

/** One avatar per species and colour. */
function make(species, color, extra) {
  const { variants: _variants, ...rest } = species;
  const skin = SKINS.find((k) => k.color === color.id);
  return {
    ...rest,
    ...extra,
    // Skins are visual only and unlock with the best score (the theme's own colour is always free); never a gameplay perk.
    // `unlockScore` is the red-theme value; use colorUnlockScore(color, theme) for the active theme.
    unlockScore: skin.unlockScore,
    trail: trailFor(species.id, color.id),
    species: species.id,
    id: `${species.id}-${color.id}`,
    color: color.id,
    colorName: color.name,
  };
}

/** The full list: every species in each colour, species in the order the picker shows them. */
export const AVATARS = Object.freeze([
  ...COLOURS.map((c) => {
    const skin = SKINS.find((k) => k.color === c.id);
    return make(FLIPPER_SPECIES, c, { palette: skin.palette });
  }),
  ...COLOURS.map((c) =>
    make(BULBULI_SPECIES, c, {
      kind: 'bird',
      palette: { eye: '#ffe9b0', ...BULBULI_SPECIES.variants[c.id] },
    }),
  ),
  ...MODEL_BIRDS.flatMap((m) => COLOURS.map((c) => make(m, c, { kind: 'model', palette: m.variants[c.id] }))),
]);

/** The species in picker order, each with its three colours: [{ id, name, tagline, kind, variants: [avatar x3] }]. */
export const AVATAR_SPECIES = Object.freeze(
  [...new Set(AVATARS.map((a) => a.species))].map((id) => {
    const variants = AVATARS.filter((a) => a.species === id);
    const { name, tagline, kind } = variants[0];
    return { id, name, tagline, kind, variants };
  }),
);

export const DEFAULT_AVATAR_ID = AVATARS[0].id;

/** Choices saved before birds had colours, mapped to the nearest bird and colour that exists now. */
const LEGACY_IDS = {
  ember: 'flipper-fire',
  azure: 'flipper-blue',
  verdant: 'flipper-blue',
  void: 'flipper-white',
  'bulbuli-sunburst': 'bulbuli-fire',
  'bulbuli-obsidian': 'bulbuli-fire',
  'scarlet-macaw': 'scarlet-macaw-fire',
  'macaw-flying': 'macaw-flying-fire',
  'macaw-blue-yellow': 'macaw-blue-yellow-blue',
  'toco-toucan': 'toco-toucan-fire',
  morpho: 'morpho-fire',
};

export function getAvatar(id) {
  const wanted = LEGACY_IDS[id] ?? id;
  return AVATARS.find((a) => a.id === wanted) ?? AVATARS[0];
}

/** The avatar of a species in a colour (or the species' Fire one if that colour does not exist). */
export function avatarFor(speciesId, colorId) {
  const all = AVATARS.filter((a) => a.species === speciesId);
  return all.find((a) => a.color === colorId) ?? all[0];
}

/** Each species is free in the theme's colour; the other warm/cool skin and White unlock with the best score. */
export function isAvatarUnlocked(avatar, bestScore, themeId = DEFAULT_THEME) {
  return isUnlocked(avatar, bestScore, themeId);
}

/** Best score needed for this avatar in a theme (0 when free). */
export function avatarUnlockScore(avatar, themeId = DEFAULT_THEME) {
  return colorUnlockScore(avatar.color, themeId);
}

/** The avatar to actually show: the selected one if unlocked, otherwise that bird in the theme's free colour. */
export function resolveAvatar(id, bestScore, themeId = DEFAULT_THEME) {
  const avatar = getAvatar(id);
  return isAvatarUnlocked(avatar, bestScore, themeId) ? avatar : avatarFor(avatar.species, getTheme(themeId).freeSkin);
}

/**
 * Collection progress: skins unlocked out of all skins (a skin is one bird in one colour), and how many of the
 * species have been flown at least once. `flown` maps species id to completed runs.
 */
export function collectionProgress(bestScore, flown = {}, themeId = DEFAULT_THEME) {
  const unlocked = AVATARS.filter((a) => isAvatarUnlocked(a, bestScore, themeId)).length;
  const flownSpecies = AVATAR_SPECIES.filter((sp) => (flown[sp.id] ?? 0) > 0).length;
  return {
    unlocked,
    total: AVATARS.length,
    species: AVATAR_SPECIES.length,
    flownSpecies,
    /** The next skin score to reach, or null when every skin is unlocked. */
    nextUnlock:
      AVATARS.map((a) => avatarUnlockScore(a, themeId))
        .filter((u) => u > bestScore)
        .sort((x, y) => x - y)[0] ?? null,
  };
}

/** Skins unlocked in one species. */
export function speciesProgress(speciesId, bestScore, themeId = DEFAULT_THEME) {
  const all = AVATARS.filter((a) => a.species === speciesId);
  return { unlocked: all.filter((a) => isAvatarUnlocked(a, bestScore, themeId)).length, total: all.length };
}

/** URL of a model bird's GLB (respects Vite's base path). */
export function modelUrl(avatar) {
  return `${import.meta.env?.BASE_URL ?? '/'}models/birds/${avatar.file}`;
}
