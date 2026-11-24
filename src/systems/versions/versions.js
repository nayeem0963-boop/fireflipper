/**
 * Game versions. A version changes how the PLAYER LOOKS and nothing else: v1 is the baseline and every other version is
 * v1 plus overrides to `playerConfig` (the avatar, its scale and offset, its trail colour). The physics, the obstacle
 * spawner, collisions, scoring, the HUD and every control (TAP, HOLD, dive, AUTO PLAY) are the one shared simulation in
 * systems/game; it never imports this file (journey-test.mjs and versions-test.mjs check that), so a version cannot
 * change how a run plays out, only how the bird is drawn.
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
 * @property {[number, number, number]} [rotation]  Extra facing, in radians, to turn a model that does not face +X (the
 *                                    direction of flight) by default. Optional; defaults to [0, 0, 0].
 * @property {AvatarClips} [clips]   Optional: which of the model's animation clips to play for each state. Without it the first
 *                                    run/fly/flap/walk clip loops.
 * @property {string} [trailColor]    Optional CSS colour for the trail behind the player; omit to use the skin's trail.
 *
 * @typedef {Object} AvatarClips        Clip names inside the avatar's GLB, chosen from the player's flight state.
 * @property {string} cruise          Loops while flying (it plays faster for a moment on each flap).
 * @property {string} [dive]          Loops while diving (falling fast).
 * @property {string} [dead]          Plays once, and holds, when the run ends.
 * @property {[number, number]} [deadRange]  Seconds of the `dead` clip to use (a clip may recover at its end).
 *
 * @typedef {Object} GameVersion
 * @property {'v1' | 'v2'} id
 * @property {string} title
 * @property {string} description
 * @property {string} [thumbnail]     Optional image URL for the picker card (under public/, e.g. 'images/versions/v2.jpg').
 * @property {PlayerConfig} playerConfig
 */

/** The size every avatar is drawn at in the game: the body matches the simulation's 0.36 collision radius. */
const PLAYER_SCALE = 0.6;

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
 * v2's player visuals: the overrides on top of v1. v2 is Aisha, the heroine of the Frost game (nayeem0963-boop/frostgirl,
 * `?game=frost`): a rigged, animated GLB, 1.68 m tall and facing +Z. Her model is public/models/v2/runner.glb.
 * To use a different runner, replace the file and tune the fields below:
 *   assetPath : the GLB under public/ (no leading slash).
 *   scale     : size; the body should read against the 0.36 collision circle (the in-game bird is 0.6).
 *   offset    : nudges the model so its body sits on the player's centre (x forward, y up, z toward the camera).
 *   rotation  : turns the model so its front points along +X (a model that faces +Z needs [0, Math.PI / 2, 0]).
 *   clips     : which animation clip plays for cruising, diving and the end of a run.
 *   trailColor: the trail behind the runner.
 * If the file is missing, v2 draws the v1 bird in its place, so the version stays playable.
 */
const V2_PLAYER = {
  ...V1_PLAYER,
  avatarType: 'v2_runner',
  assetPath: 'models/v2/runner.glb',
  scale: [0.8, 0.8, 0.8], // 1.68 m tall x 0.8 = 1.34 world units
  offset: [0, -0.7, 0], // her body's centre (0.88 m up) lands on the player's centre, where the collider is
  rotation: [0, Math.PI / 2, 0], // Aisha faces +Z; the game flies toward +X
  clips: { cruise: 'run', dive: 'sprint', dead: 'slide', deadRange: [0.05, 1.05] },
  trailColor: '#8fd8ff', // an icy blue, for Frost
};

/** @type {GameVersion} */
const V1 = {
  id: 'v1',
  title: 'v1 · Original',
  description: 'The original Fire Flipper: fly as the bird and skin you choose.',
  thumbnail: undefined,
  playerConfig: V1_PLAYER,
};

/** @type {GameVersion} */
const V2 = {
  ...V1,
  id: 'v2',
  title: 'v2 · New Runner',
  description: 'The same game, flown as Aisha from Frost: a runner with her own stride.',
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

/** True when the version draws the player's own picked bird and skin (the original game's avatar). */
export const usesOriginalAvatar = (version) => version.playerConfig.avatarType === 'v1_original';

/** The trail for a version: the skin's trail, or one in the version's `trailColor` (the skin's style is kept). Pure. */
export function trailForVersion(version, skinTrail) {
  const color = version.playerConfig.trailColor;
  if (!color) return skinTrail;
  return { stops: [color, color, color], spark: color, style: skinTrail.style };
}
