/**
 * The original bird's colours (Fire, Blue, White). Pure data: a skin is a colour palette for the bird, and
 * unlocks once the player's best free-play score reaches `unlockScore`.
 * (A typical skilled 3,000 m run scores about 5,000.)
 */
export const SKINS = Object.freeze([
  {
    id: 'flipper-fire',
    name: 'Fire',
    color: 'fire',
    unlockScore: 0,
    palette: {},
  },
  {
    id: 'flipper-blue',
    name: 'Blue',
    color: 'blue',
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
    id: 'flipper-white',
    name: 'White',
    color: 'white',
    unlockScore: 1500,
    palette: {
      body: '#e8eef7',
      bodyEmissive: '#9fb4d6',
      belly: '#ffffff',
      bellyEmissive: '#cfe0ff',
      wing: '#f4f7ff',
      wingEmissive: '#b8cdf5',
      wingInner: '#ffffff',
      flame: '#e6f2ff',
      beak: '#ffd88a',
      beakEmissive: '#ffcf6a',
      glow: '#cfe4ff',
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
