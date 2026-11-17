/**
 * Firebird skins. Pure data: a skin is a colour palette for the bird, and
 * unlocks once the player's best free-play score reaches `unlockScore`.
 * (A typical skilled 3,000 m run scores about 5,000.)
 */
export const SKINS = Object.freeze([
  {
    id: 'ember',
    name: 'Ember',
    unlockScore: 0,
    palette: {},
  },
  {
    id: 'azure',
    name: 'Azure Flame',
    unlockScore: 600,
    palette: {
      body: '#1f8fff',
      bodyEmissive: '#0a4fc2',
      belly: '#9fe3ff',
      bellyEmissive: '#3aa8ff',
      wing: '#2aa3ff',
      wingEmissive: '#0a6cff',
      wingInner: '#c8f1ff',
      flame: '#bfeaff',
      beak: '#e8fbff',
      beakEmissive: '#6cc8ff',
      glow: '#3aa8ff',
    },
  },
  {
    id: 'verdant',
    name: 'Verdant Blaze',
    unlockScore: 1500,
    palette: {
      body: '#27d96a',
      bodyEmissive: '#0a8a3a',
      belly: '#d8ff9a',
      bellyEmissive: '#7aff5a',
      wing: '#3df07a',
      wingEmissive: '#10b04a',
      wingInner: '#eaffb8',
      flame: '#e6ffb0',
      beak: '#fff2a8',
      beakEmissive: '#d6ff4a',
      glow: '#5aff7a',
    },
  },
  {
    id: 'void',
    name: 'Void Phoenix',
    unlockScore: 3000,
    palette: {
      body: '#8a3dff',
      bodyEmissive: '#4a14b8',
      belly: '#ff7ad9',
      bellyEmissive: '#d12aa8',
      wing: '#a24dff',
      wingEmissive: '#6a1fff',
      wingInner: '#ffb3f0',
      flame: '#ffd0f6',
      beak: '#ffe0fa',
      beakEmissive: '#ff6ad2',
      glow: '#b04dff',
    },
  },
]);

export const DEFAULT_SKIN_ID = SKINS[0].id;

export function getSkin(id) {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

export function isUnlocked(skin, bestScore) {
  return bestScore >= skin.unlockScore;
}

/** The skin to actually show: the selected one if unlocked, otherwise the default. */
export function resolveSkin(id, bestScore) {
  const skin = getSkin(id);
  return isUnlocked(skin, bestScore) ? skin : SKINS[0];
}

/** Skins that a score newly unlocks (previous best < threshold <= new best). */
export function newlyUnlocked(previousBest, newBest) {
  return SKINS.filter((s) => s.unlockScore > previousBest && s.unlockScore <= newBest);
}
