import { SKINS, isUnlocked } from '../skins/skins.js';

/**
 * Every bird the player can fly as. Two kinds:
 *
 *  - 'firebird': the original Fire Flipper bird in one of its colour schemes (unlocked by best score; see skins.js).
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
]);

/** The full list, in the order the picker shows it: the original bird's colour schemes, then the model birds. */
export const AVATARS = Object.freeze([
  ...SKINS.map((s) => ({ ...s, kind: 'firebird', unlockScore: s.unlockScore })),
  ...MODEL_BIRDS.map((m) => ({ ...m, kind: 'model', unlockScore: 0 })),
]);

export const DEFAULT_AVATAR_ID = AVATARS[0].id;

export function getAvatar(id) {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}

/** Model birds are always free; the original bird's schemes unlock by best score. */
export function isAvatarUnlocked(avatar, bestScore) {
  return avatar.kind === 'model' || isUnlocked(avatar, bestScore);
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
