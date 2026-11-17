import { SKINS, isUnlocked } from '../skins/skins.js';

/**
 * Every bird the player can fly as. Two kinds:
 *
 *  - 'firebird': the original Fire Flipper bird in one of its colour schemes (unlocked by best score; see skins.js).
 *  - 'bird': a code-built bird from the Bulbuli project (the Bulbuli mascot in four fire colourways, and the
 *    tanager in two), with real wing beats. No model file and no third-party licence: it is built from primitives
 *    and generated geometry. `form` says which ('bulbuli' or 'tanager'); `palette` gives its colours.
 *  - 'model': a real 3D bird model re-lit as a fire bird at run time (flame-coloured plumage, glow and a flame
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
 *             feathers still catch fire
 */
export const MODEL_BIRDS = Object.freeze([
  {
    id: 'scarlet-macaw',
    name: 'Blaze Macaw',
    tagline: 'A scarlet macaw trailing a ribbon of fire',
    file: 'scarlet-macaw.glb',
    facing: Math.PI / 2,
    pitch: 0,
    length: 2.0,
    lift: 0,
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
    name: 'Rainbow Phoenix',
    tagline: 'A rainbow macaw reborn in flame',
    file: 'macaw-flying.glb',
    facing: Math.PI / 2,
    pitch: -0.55,
    length: 2.4,
    lift: 0,
    palette: {
      low: '#b01540',
      mid: '#ff7a1a',
      high: '#ffe27a',
      glow: '#ff6a3a',
      mix: 0.8,
      glowStrength: 0.9,
      lumFloor: 0.2,
    },
  },
  {
    id: 'macaw-blue-yellow',
    name: 'Sapphire Macaw',
    tagline: 'Blue-and-yellow macaw wreathed in blue fire',
    file: 'macaw-blue-yellow.glb',
    facing: Math.PI / 2,
    pitch: -0.25,
    length: 2.0,
    lift: 0,
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
    name: 'Ember Toucan',
    tagline: 'A toco toucan with a glowing coal of a beak',
    file: 'toco-toucan.glb',
    facing: Math.PI / 2,
    pitch: 0,
    length: 2.0,
    lift: 0,
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
    id: 'harpy-eagle',
    name: 'Inferno Harpy',
    tagline: 'The harpy eagle, burning white-hot at the crest',
    file: 'harpy-eagle.glb',
    facing: Math.PI / 2,
    pitch: -1.15,
    length: 2.0,
    lift: 0,
    palette: {
      low: '#2a0612',
      mid: '#d4281c',
      high: '#ffd9a0',
      glow: '#ff6a2a',
      mix: 0.9,
      glowStrength: 1,
      lumFloor: 0.25,
    },
  },
  {
    id: 'hoatzin',
    name: 'Magma Hoatzin',
    tagline: 'The crested hoatzin, molten from tail to crown',
    file: 'hoatzin.glb',
    facing: Math.PI / 2,
    pitch: 0,
    length: 2.0,
    lift: 0,
    palette: {
      low: '#8a0a5a',
      mid: '#ff4a1a',
      high: '#ffe066',
      glow: '#ff5a8a',
      mix: 0.85,
      glowStrength: 1,
      lumFloor: 0.25,
    },
  },
  {
    id: 'morpho',
    name: 'Fire Morpho',
    tagline: 'A blue morpho butterfly set ablaze',
    form: 'butterfly',
    file: 'morpho.glb',
    // The model's head is at its -z end and its body is tilted about 39 degrees nose-up in the resting pose.
    facing: -Math.PI / 2,
    pitch: -0.67,
    length: 2.9,
    lift: 0,
    // Butterfly wings beat for real: how far the stroke swings them, and the height of the hinge along the body.
    beat: 0.9,
    // Where the wings meet the body, and the turn that lines a frame's z axis up with the (tilted) body.
    hingePoint: [0, 0.054, -0.031],
    hingeTilt: -2.46,
    roll: 0.6,
    palette: {
      low: '#a3120a',
      mid: '#ff5a14',
      high: '#ffd36b',
      glow: '#ff7a2a',
      mix: 0.9,
      glowStrength: 1,
      lumFloor: 0.3,
    },
  },
]);

const BULBULI = (id, name, tagline, p) => ({
  id,
  name,
  tagline,
  form: 'bulbuli',
  length: 1.9,
  palette: { eye: '#ffe9b0', ...p },
});

/** Bulbuli the red-whiskered bulbul, in four fire colourways. */
const BULBULI_BIRDS = [
  BULBULI('bulbuli-fire', 'Fire Bulbuli', 'Bulbuli the red-whiskered bulbul, crest ablaze', {
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
  }),
  BULBULI('bulbuli-sunburst', 'Sunburst Bulbuli', 'A golden Bulbuli trailing sunlight', {
    body: '#5a3208',
    wing: '#8a5412',
    belly: '#fff3c4',
    crest: '#ffd23a',
    cheek: '#ffb000',
    accent: '#ffe27a',
    beak: '#fff0a8',
    glow: '#ffb02a',
    low: '#c27a0a',
    mid: '#ffb02a',
    high: '#fff0a8',
  }),
  BULBULI('bulbuli-blue', 'Blue-Flame Bulbuli', 'Bulbuli wrapped in cold blue fire', {
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
  }),
  BULBULI('bulbuli-obsidian', 'Obsidian Bulbuli', 'A shadow Bulbuli with a violet flame', {
    body: '#150a22',
    wing: '#2a1244',
    belly: '#d9c4ff',
    crest: '#c04aff',
    cheek: '#ff4ad2',
    accent: '#e08aff',
    beak: '#f0d4ff',
    glow: '#b04dff',
    low: '#4a0f8a',
    mid: '#b04dff',
    high: '#ffd4f6',
  }),
];

/** The tanager (the Bulbuli project's code-built rainforest bird) in two flames. */
const TANAGER_BIRDS = [
  {
    id: 'tanager-ember',
    name: 'Ember Tanager',
    tagline: "Bulbuli's rainforest tanager, all afire",
    form: 'tanager',
    length: 2.0,
    palette: {
      colors: {
        breast: '#ff7a1a',
        breastLow: '#ffb347',
        head: '#ff3a10',
        headTop: '#ff6a2a',
        back: '#8a1f0c',
        backDark: '#4a0f08',
        tail: '#4a0c08',
        tailTip: '#1a0504',
        beak: '#ffd36b',
        beakTip: '#ff9d2a',
        leg: '#c0501a',
      },
      wing: { root: '#ffb347', tip: '#b3200c', edge: '#400a05' },
      glow: '#ff6a2a',
      low: '#a3120a',
      mid: '#ff5a14',
      high: '#ffd36b',
    },
  },
  {
    id: 'tanager-cobalt',
    name: 'Cobalt Tanager',
    tagline: 'A tanager in blue flame',
    form: 'tanager',
    length: 2.0,
    palette: {
      colors: {
        breast: '#2ea6ff',
        breastLow: '#9fe3ff',
        head: '#1f6bff',
        headTop: '#4aa8ff',
        back: '#0b2f8a',
        backDark: '#061a4d',
        tail: '#061a4d',
        tailTip: '#030c26',
        beak: '#d8f6ff',
        beakTip: '#6cc8ff',
        leg: '#2a7ad8',
      },
      wing: { root: '#9fe3ff', tip: '#0b3fb8', edge: '#04184a' },
      glow: '#3aa8ff',
      low: '#0b3fb8',
      mid: '#2ea6ff',
      high: '#d8f6ff',
    },
  },
];

/** The full list, in the order the picker shows it. `group` is the section heading. */
export const AVATARS = Object.freeze([
  ...SKINS.map((s) => ({ ...s, kind: 'firebird', group: 'Fire Flipper' })),
  ...[...BULBULI_BIRDS, ...TANAGER_BIRDS].map((b) => ({
    ...b,
    kind: 'bird',
    group: 'Bulbuli and friends',
    unlockScore: 0,
  })),
  ...MODEL_BIRDS.map((m) => ({ ...m, kind: 'model', group: 'Fire-lit wildlife', unlockScore: 0 })),
]);

/** Section headings, in order. */
export const AVATAR_GROUPS = Object.freeze(['Fire Flipper', 'Bulbuli and friends', 'Fire-lit wildlife']);

export const DEFAULT_AVATAR_ID = AVATARS[0].id;

export function getAvatar(id) {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}

/** Only the original bird's colour schemes are locked (by best score); every other bird is free. */
export function isAvatarUnlocked(avatar, bestScore) {
  return avatar.kind !== 'firebird' || isUnlocked(avatar, bestScore);
}

/** The avatar to actually show: the selected one if unlocked, otherwise the default. */
export function resolveAvatar(id, bestScore) {
  const avatar = getAvatar(id);
  return isAvatarUnlocked(avatar, bestScore) ? avatar : AVATARS[0];
}

/** URL of a model bird's GLB (respects Vite's base path). */
export function modelUrl(avatar) {
  return `${import.meta.env?.BASE_URL ?? '/'}models/birds/${avatar.file}`;
}
