/**
 * Game versions. v1 is the original flying game and is never changed by a version. Every other version is v1 plus overrides:
 *  - `playerConfig`: how the player LOOKS (the avatar, its scale and offset, its trail colour), and
 *  - `ruleset`: which simulation runs. 'flight' is the original flying game (systems/game); 'runner' is the ground-runner
 *    (systems/runner): she runs on the land, TAP jumps, and it has its own obstacles. Both share the world scenery, the five-world
 *    journey, the run speed curve, the scoring, the HUD, the controls (TAP / HOLD / Down) and Auto play.
 * Neither simulation imports this file (versions-test.mjs checks that): the store and the scene pick the simulation for a version,
 * and an avatar is only ever drawn, never read by a simulation.
 *
 * To add or tune v2's look, edit `V2_PLAYER` below: that is the only place for the asset's path, scale, offset, facing and clips.
 *
 * (The project is plain JavaScript, so the shape is a JSDoc type rather than a TypeScript interface.)
 *
 * @typedef {'v1_original' | 'v2_runner'} AvatarType
 *
 * @typedef {Object} PlayerConfig
 * @property {AvatarType} avatarType  'v1_original' draws the bird (and skin) the player picked, as before; 'v2_runner'
 *                                    draws the GLB at `assetPath` instead.
 * @property {string} assetPath       GLB path under public/ (no leading slash), e.g. 'models/v2/runner.glb'. Unused by
 *                                    'v1_original', which has no single asset (it follows the picked skin).
 * @property {[number, number, number]} scale   Uniform-or-not scale of the avatar. 0.6 matches the bird's body to the
 *                                    0.36 collision radius; wings and tail do not collide.
 * @property {[number, number, number]} offset  Position of the avatar inside the player's group, in world units. Visual
 *                                    only: the collider stays where the simulation puts it.
 * @property {number} [height]       The avatar's height in the model's own units (metres). The menu preview sizes it to a fixed height from this, so a
 *                                    bigger in-game avatar never overflows the preview ring.
 * @property {number} [centre]       Height of the avatar's body centre above its origin, in the model's own units (metres): where a menu preview
 *                                    centres it. For an avatar standing on its origin (a runner) it is about half its height.
 * @property {[number, number, number]} [rotation]  Extra facing, in radians, to turn a model that does not face +X (the
 *                                    direction of flight) by default. Optional; defaults to [0, 0, 0].
 * @property {boolean} [upright]     Keep the avatar upright instead of pitching and tumbling with the flight path. A running
 *                                    character sets this; the flying bird leaves it off. Visual only.
 * @property {AvatarClips} [clips]    Optional: which of the model's animation clips to play for each state. Without it the first
 *                                    run/fly/flap/walk clip loops.
 * @property {string} [trailColor]    Optional CSS colour for the trail behind the player; omit to use the skin's trail.
 *
 * @typedef {string | {clip: string, range?: [number, number], timeScale?: number, loop?: boolean, noLift?: boolean}} ClipDef
 *   A clip name, or a clip with options: `range` plays only those seconds of it, `timeScale` its speed, `loop` whether it repeats
 *   (the default is to loop `cruise` and `dive` and to play the others once and hold the last pose) and `noLift` removes the hip
 *   lift baked into a jump clip (the game already moves the player up and down).
 *
 * @typedef {Object} AvatarClips        Clips inside the avatar's GLB, chosen from the player's flight state.
 * @property {ClipDef} cruise           Level flight; plays faster for a moment on each flap.
 * @property {ClipDef} [rise]           Climbing (after a flap).
 * @property {ClipDef} [fall]           Sinking.
 * @property {ClipDef} [dive]           Diving (falling at full speed).
 * @property {ClipDef} [dead]           The end of a run.
 *
 * @typedef {Object} GameVersion
 * @property {'v1' | 'v2'} id
 * @property {'flight' | 'runner'} ruleset  Which simulation this version runs (see above).
 * @property {string} title
 * @property {string} description
 * @property {string} [thumbnail]     Optional image URL for the picker card (under public/, e.g. 'images/versions/v2.jpg').
 * @property {PlayerConfig} playerConfig
 */

/** The size every avatar is drawn at in the game: the body matches the simulation's 0.36 collision radius. */
const PLAYER_SCALE = 0.6;

/** How tall (world units) a menu preview draws an avatar whose `height` is known: it fits the ring on desktop and phones whatever its in-game size. */
const PREVIEW_HEIGHT = 3.5;

/** The menu previews draw the player at the size the original bird is shown there (it is unscaled), i.e. 1 / PLAYER_SCALE of its in-game size. */
export const PREVIEW_SIZE_FACTOR = 1 / PLAYER_SCALE;

/** The baseline: the original game, exactly as it was. */
const V1_PLAYER = {
  avatarType: 'v1_original',
  assetPath: '',
  scale: [PLAYER_SCALE, PLAYER_SCALE, PLAYER_SCALE],
  offset: [0, 0, 0],
};

/**
 * v2's player visuals: the overrides on top of v1. v2 is a RUNNING model: Aisha, the heroine of the Frost game
 * (nayeem0963-boop/frostgirl, `?game=frost`), a rigged, animated GLB, 1.68 m tall and facing +Z, upright (`upright`) so she
 * runs, jumps and falls instead of flying. Her model is public/models/v2/runner.glb. v1 stays the flying bird.
 * To use a different runner, replace the file and tune the fields below:
 *   assetPath : the GLB under public/ (no leading slash).
 *   scale     : size; the body should read against the 0.36 collision circle (the in-game bird is 0.6).
 *   offset    : nudges the model so its body sits on the player's centre (x forward, y up, z toward the camera).
 *   rotation  : turns the model so its front points along +X (a model that faces +Z needs [0, Math.PI / 2, 0]).
 *   upright   : true keeps the body upright whatever the flight path does.
 *   clips     : which animation clip plays for cruising, rising, falling, diving and the end of a run.
 *   trailColor: the trail behind the runner.
 * If the file is missing, v2 draws the v1 bird in its place, so the version stays playable.
 */
const AISHA_SCALE = 1.6; // 1.68 m tall x 1.6 = 2.7 world units: big and prominent on the land (her collider is unchanged: see the note on `scale`)
const V2_PLAYER = {
  ...V1_PLAYER,
  avatarType: 'v2_runner',
  assetPath: 'models/v2/runner.glb',
  scale: [AISHA_SCALE, AISHA_SCALE, AISHA_SCALE], // NOTE: only the drawing grows; what hurts her (the runner's colliders) is fixed, so a bigger drawing is more forgiving, never less
  height: 1.68, // her height in metres
  offset: [0, 0, 0], // her feet are her origin and stand on the land (the runner's `y` is the height of her feet)
  centre: 0.88, // her body's centre, 0.88 m up: where the menu preview centres her
  rotation: [0, Math.PI / 2, 0], // Aisha faces +Z; the game flies toward +X
  upright: true, // a runner stays on her feet: no pitching or tumbling
  clips: {
    idle: 'idle', // waiting for the first press
    // The run cycle is matched to the ground speed so her feet don't slide: her run clip covers about 4.8 m/s at her own size, which the scale multiplies.
    cruise: { clip: 'run', speedRef: 4.8 * AISHA_SCALE },
    // Her jump clip is one long hop: the take-off and apex are the rise, the descent is the fall (the hip lift is removed).
    rise: { clip: 'land', range: [0.52, 0.86], timeScale: 1.05, noLift: true },
    fall: { clip: 'land', range: [0.86, 1.06], timeScale: 0.35, noLift: true },
    dive: 'sprint',
    dead: { clip: 'slide', range: [0.05, 1.05], noLift: true }, // her stumble
  },
  trailColor: '#8fd8ff', // an icy blue, for Frost
};

/** @type {GameVersion} */
const V1 = {
  id: 'v1',
  ruleset: 'flight',
  title: 'v1 · Original',
  description: 'The original flying game: fly as the bird and skin you choose.',
  thumbnail: undefined,
  playerConfig: V1_PLAYER,
};

/** @type {GameVersion} */
const V2 = {
  ...V1,
  id: 'v2',
  ruleset: 'runner',
  title: 'v2 · New Runner',
  description: 'A new way to play: run the five worlds on foot as Aisha from Frost, jumping rocks, ice and pits.',
  thumbnail: undefined, // PLACEHOLDER: e.g. 'images/versions/v2.jpg'
  playerConfig: V2_PLAYER,
};

/** Every version, in the order the menu lists them. */
export const GAMES_CONFIG = Object.freeze(
  [V1, V2].map((v) => Object.freeze({ ...v, playerConfig: Object.freeze({ ...v.playerConfig }) })),
);

export const VERSION_IDS = Object.freeze(GAMES_CONFIG.map((v) => v.id));
export const DEFAULT_VERSION_ID = 'v1';
/** The query parameter that selects a version, e.g. /?version=v2. */
export const VERSION_PARAM = 'version';
/** Key under which the player's last choice is saved (see utils/storage.js). */
export const VERSION_STORAGE_KEY = 'gameVersion';

export const isVersionId = (id) => VERSION_IDS.includes(id);

/** The version for an id; anything unknown gives the baseline, so a bad saved value or link can never break the game. */
export function getVersion(id) {
  return GAMES_CONFIG.find((v) => v.id === id) ?? GAMES_CONFIG[0];
}

/**
 * Which version to start in: a valid ?version= in the URL wins (so a link opens straight into it), then the saved choice,
 * then v1. `search` is a query string like location.search.
 */
export function resolveInitialVersionId(search, saved) {
  const fromUrl = new URLSearchParams(search ?? '').get(VERSION_PARAM);
  if (isVersionId(fromUrl)) return fromUrl;
  return isVersionId(saved) ? saved : DEFAULT_VERSION_ID;
}

/** `href` with ?version=<id> set (other parameters, such as ?hazards=0, and the hash are kept). Pure; returns a relative URL. */
export function urlForVersion(href, id) {
  const url = new URL(href, 'http://local.invalid');
  url.searchParams.set(VERSION_PARAM, id);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Writes the chosen version into the address bar without a reload or a new history entry. A no-op where there is no window. */
export function syncVersionToLocation(id) {
  try {
    if (typeof window === 'undefined') return;
    window.history.replaceState(window.history.state, '', urlForVersion(window.location.href, id));
  } catch {
    /* history unavailable (sandboxed frame): the choice is still kept in the store and in storage */
  }
}

/** URL of a version's avatar GLB (respects Vite's base path); '' when the version has none. */
export function avatarAssetUrl(version) {
  const path = version.playerConfig.assetPath.replace(/^\/+/, '');
  return path ? `${import.meta.env?.BASE_URL ?? '/'}${path}` : '';
}

/** True when the version runs the ground-runner simulation (v2) and not the original flying game. */
export const isRunner = (version) => version.ruleset === 'runner';

/** True when the avatar stays upright (a running model) instead of pitching and tumbling with the flight path. */
export const isUpright = (version) => !!version.playerConfig.upright;

/** The factor a menu preview multiplies the configured scale by: an avatar of known height is drawn at a fixed preview height, any other at 1 / PLAYER_SCALE (as the bird is). */
export function previewSizeFactor(version) {
  const { height, scale } = version.playerConfig;
  return height ? PREVIEW_HEIGHT / (height * scale[1]) : PREVIEW_SIZE_FACTOR;
}

/** True when the version draws the player's own picked bird and skin (the original game's avatar). */
export const usesOriginalAvatar = (version) => version.playerConfig.avatarType === 'v1_original';

/** The trail for a version: the skin's trail, or one in the version's `trailColor` (the skin's style is kept). Pure. */
export function trailForVersion(version, skinTrail) {
  const color = version.playerConfig.trailColor;
  if (!color) return skinTrail;
  return { stops: [color, color, color], spark: color, style: skinTrail.style };
}
