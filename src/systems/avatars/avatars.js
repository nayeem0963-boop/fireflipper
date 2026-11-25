import { FREE_COLOR, SKINS, colorUnlockScore, isUnlocked } from '../skins/skins.js';

/**
 * Every bird the player can fly as: three species (FlameBird, Honeybell, Morpho Butterfly), each in three colours (Fire, Blue and White), so 9 avatars. FlameBird, the mascot, is first (the default bird). (The Flipper is not in the list; its model is kept only for the Celestial reward skin.)
 * A species is named for what it is (never for its colour); the colour is chosen separately.
 *
 * Each avatar carries its species' fields plus `species` (the species id), `color` ('fire' | 'blue' | 'white'),
 * `colorName`, and that colour's `palette`. Its `id` is `<species>-<color>`; that is what is saved as the choice.
 *
 * Kinds of species:
 *  - 'firebird': the original Fire Flipper bird (unlocked colour by colour by best score; see skins.js).
 *  - 'model': a real 3D bird model re-lit as a fire bird at run time (colour-tinted plumage, glow and a flame
 *    tail). The models are third-party (CC BY 4.0); credits are in credits.js and shown in the app. They are
 *    free to choose: the choice is cosmetic and changes nothing about the physics or the collision size.
 *
 *  - 'flamebird': FlameBird, the Fire Flipper mascot: a rigged GLB with real clips (flight, wing beat, idle, celebrate) drawn by
 *    FlameBird.jsx. Made for Fire Flipper (see public/models/CREDITS.md).
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
    id: 'macaw-blue-yellow',
    name: 'Honeybell',
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


/**
 * FlameBird, the Fire Flipper mascot (goggles, scarf, flame crest): a rigged GLB with its own clips (FB_Fly, FB_WingFlap,
 * FB_Idle, FB_TailSway, FB_Celebrate), drawn by FlameBird.jsx. Fire shows the model's own painted textures unchanged
 * (mix 0); Blue and White re-colour them by brightness onto low / mid / high (mix = how much of that ramp replaces the
 * original). `glow` tints the halo and the bird's light. It is the first species, so it is the default bird.
 */
const FLAMEBIRD_SPECIES = {
  id: 'flamebird',
  name: 'FlameBird',
  tagline: 'The Fire Flipper mascot, goggles on',
  kind: 'flamebird',
  file: 'flamebird.glb',
  variants: {
    fire: { mix: 0, glow: '#ff7a2a', low: '#a3120a', mid: '#ff5a14', high: '#ffd070' },
    blue: { mix: 0.85, glow: '#3aa8ff', low: '#0b3fb8', mid: '#2ea6ff', high: '#d8f6ff' },
    white: { mix: 0.85, glow: '#cfe4ff', low: '#8fa3c4', mid: '#e6edf8', high: '#ffffff' },
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
  flipper: { stops: ['#fff3b0', '#3a8cff', '#0b3fb8'], spark: '#ffd84a', style: 'shimmer' }, // the macaw leaves a blue shimmer with gold sparks
  'macaw-blue-yellow': { stops: ['#ffe14a', '#2ea6ff', '#0b3fb8'], spark: '#d8f6ff', style: 'flame' },
  morpho: { stops: ['#ffe9a8', '#ff7a3a', '#b21e6a'], spark: '#ffb3e0', style: 'shimmer' },
  flamebird: { stops: ['#ffe9a8', '#ff5a14', '#a3120a'], spark: '#ffb347', style: 'flame' },
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

/** The original bird. It is no longer a pickable species; it is only worn as the Celestial reward skin below (its colours come from skins.js). */
const FLIPPER_SPECIES = {
  id: 'flipper',
  name: 'Flipper',
  tagline: 'The original flyer: a blue-and-yellow macaw',
  kind: 'firebird',
};

/** One avatar per species and colour. */
function make(species, color, extra) {
  const { variants: _variants, ...rest } = species;
  const skin = SKINS.find((k) => k.color === color.id);
  return {
    ...rest,
    ...extra,
    // Skins are visual only and unlock with the best score (Fire is always free; the theme never changes a bird's colour); never a gameplay perk.
    // `unlockScore` is the red-theme value; use colorUnlockScore(color, theme) for the active theme.
    unlockScore: skin ? skin.unlockScore : Infinity, // a reward skin has no score threshold: it unlocks by its journey reward
    trail: trailFor(species.id, color.id),
    species: species.id,
    id: `${species.id}-${color.id}`,
    color: color.id,
    colorName: color.name,
  };
}

/** The full list: every species in each colour, species in the order the picker shows them. */
export const AVATARS = Object.freeze([
  ...COLOURS.map((c) => make(FLAMEBIRD_SPECIES, c, { palette: FLAMEBIRD_SPECIES.variants[c.id] })),
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

/**
 * Reward skins: earned by journey rewards, never by score, and NOT part of the 9-skin collection above (its counts and the picker are unchanged). Purely cosmetic: like every
 * bird it only changes how the bird LOOKS; the simulation never reads an avatar, so the hitbox, the physics and the scoring are the same.
 */
const CELESTIAL_PALETTE = {
  body: '#ffc93c',
  bodyEmissive: '#ff9a1f',
  belly: '#fff3c4',
  bellyEmissive: '#ffd877',
  wing: '#ffd25a',
  wingEmissive: '#ffa52e',
  wingInner: '#fff8dc',
  flame: '#fff1a8',
  beak: '#ffe9a0',
  beakEmissive: '#ffcf5a',
  glow: '#ffd870',
  crown: '#fff1a8',
  face: '#fff8dc',
  chin: '#b8680c',
  low: '#d9902a',
  mid: '#ffd25a',
  high: '#fff6d0',
};
export const REWARD_AVATARS = Object.freeze([
  Object.freeze({
    ...make(FLIPPER_SPECIES, { id: 'celestial', name: 'Celestial' }, { palette: CELESTIAL_PALETTE }),
    reward: 'celestial-skin',
    trail: Object.freeze({ stops: ['#fffbe0', '#ffd25a', '#e08a1a'], spark: '#fff2a8', style: 'shimmer' }),
  }),
]);

export const DEFAULT_AVATAR_ID = AVATARS[0].id;

/**
 * Choices saved for birds that are no longer offered (Bulbuli, the Rainbow / Scarlet Macaw, the Toco Toucan, the Fire Eagle
 * and the old colour names) show FlameBird, the default: an unknown id falls back to the first bird (see getAvatar). Old
 * single-name ids of the two remaining models map to them.
 */
const LEGACY_IDS = {
  'macaw-blue-yellow': 'macaw-blue-yellow-blue',
  morpho: 'morpho-fire',
};

export function getAvatar(id) {
  const wanted = LEGACY_IDS[id] ?? id;
  return AVATARS.find((a) => a.id === wanted) ?? REWARD_AVATARS.find((a) => a.id === wanted) ?? AVATARS[0];
}

/** The avatar of a species in a colour (or the species' Fire one if that colour does not exist). */
export function avatarFor(speciesId, colorId) {
  const all = AVATARS.filter((a) => a.species === speciesId);
  if (!all.length) return avatarFor(AVATARS[0].species, colorId); // a species that is not in the list (the Flipper) shows the first bird instead
  return all.find((a) => a.color === colorId) ?? all[0];
}

/** Each species is free in the theme's colour; the other warm/cool skin and White unlock with the best score; a reward skin unlocks with its journey reward (`rewards`: the owned map). */
export function isAvatarUnlocked(avatar, bestScore, themeId, rewards = null) {
  if (avatar.reward) return !!rewards?.[avatar.reward];
  return isUnlocked(avatar, bestScore, themeId);
}

/** Best score needed for this avatar in a theme (0 when free). */
export function avatarUnlockScore(avatar, themeId) {
  return colorUnlockScore(avatar.color, themeId);
}

/** The avatar to actually show: the selected one if unlocked, otherwise that bird in Fire, its free colour. */
export function resolveAvatar(id, bestScore, themeId, rewards = null) {
  const avatar = getAvatar(id);
  return isAvatarUnlocked(avatar, bestScore, themeId, rewards) ? avatar : avatarFor(avatar.species, FREE_COLOR);
}

/**
 * Collection progress: skins unlocked out of all skins (a skin is one bird in one colour), and how many of the
 * species have been flown at least once. `flown` maps species id to completed runs.
 */
export function collectionProgress(bestScore, flown = {}, themeId) {
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
export function speciesProgress(speciesId, bestScore, themeId) {
  const all = AVATARS.filter((a) => a.species === speciesId);
  return { unlocked: all.filter((a) => isAvatarUnlocked(a, bestScore, themeId)).length, total: all.length };
}

/** URL of a model bird's GLB (respects Vite's base path). */
export function modelUrl(avatar) {
  return `${import.meta.env?.BASE_URL ?? '/'}models/birds/${avatar.file}`;
}
