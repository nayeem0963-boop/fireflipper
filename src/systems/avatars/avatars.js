import { SKINS, isUnlocked } from '../skins/skins.js';

/**
 * Every bird the player can fly as. Two kinds:
 *
 *  - 'firebird': the original Fire Flipper bird in one of its colour schemes (unlocked by best score; see skins.js).
 *  - 'bird': a code-built bird from the Bulbuli project (the Bulbuli mascot in four fire colourways), with real
 *    wing beats. No model file and no third-party licence: it is built from primitives. `form` says which
 *    ('bulbuli'); `palette` gives its colours.
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
    name: 'Rainbow Phoenix',
    tagline: 'A rainbow macaw reborn in flame',
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
    name: 'Sapphire Macaw',
    tagline: 'Blue-and-yellow macaw wreathed in blue fire',
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
    name: 'Ember Toucan',
    tagline: 'A toco toucan with a glowing coal of a beak',
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
    name: 'Fire Morpho',
    tagline: 'A blue morpho butterfly set ablaze',
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

/** The full list, in the order the picker shows it. `group` is the section heading. */
export const AVATARS = Object.freeze([
  ...SKINS.map((s) => ({ ...s, kind: 'firebird', group: 'Fire Flipper' })),
  ...BULBULI_BIRDS.map((b) => ({
    ...b,
    kind: 'bird',
    group: 'Bulbuli',
    unlockScore: 0,
  })),
  ...MODEL_BIRDS.map((m) => ({ ...m, kind: 'model', group: 'Fire-lit wildlife', unlockScore: 0 })),
]);

/** Section headings, in order. */
export const AVATAR_GROUPS = Object.freeze(['Fire Flipper', 'Bulbuli', 'Fire-lit wildlife']);

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
