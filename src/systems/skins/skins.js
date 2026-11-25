
/**
 * The original bird's colours (Fire, Blue, White). The Flipper is a blue-and-yellow macaw (components/scene/Firebird.jsx), so the base colour (still called Fire, like the other birds' base colour) is the macaw's
 * own blue and yellow (the palette is empty: the bird's defaults), and Blue and White recolour the same macaw. Pure data: a skin is a colour palette for the bird, and
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
      crown: '#7fe8ff',
      face: '#f4fbff',
      chin: '#0a4fc2',
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
      crown: '#ffffff',
      face: '#ffffff',
      chin: '#9fb4d6',
    },
  },
]);

/** The bird colour that is free from the start. The theme never changes a bird's colour: Fire, Blue and White are the bird's own choice. */
export const FREE_COLOR = 'fire';

/**
 * Best score at which a colour unlocks: Fire is free, Blue and White unlock with the best score. Purely cosmetic. (`themeId`
 * is accepted and ignored, so older callers keep working: bird colour no longer follows the theme.)
 */
// eslint-disable-next-line no-unused-vars
export function colorUnlockScore(colorId, themeId) {
  if (colorId === FREE_COLOR) return 0;
  return SKINS.find((k) => k.color === colorId)?.unlockScore ?? SKINS.find((k) => k.color === 'blue').unlockScore;
}

export const DEFAULT_SKIN_ID = SKINS[0].id;

export function getSkin(id) {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

export function isUnlocked(skin, bestScore, themeId) {
  return bestScore >= colorUnlockScore(skin.color, themeId);
}

/** The skin to actually show: the selected one if unlocked, otherwise the default. */
export function resolveSkin(id, bestScore, themeId) {
  const skin = getSkin(id);
  return isUnlocked(skin, bestScore, themeId) ? skin : SKINS[0];
}

/** Skins that a score newly unlocks (previous best < threshold <= new best). */
export function newlyUnlocked(previousBest, newBest, themeId) {
  return SKINS.filter((k) => {
    const at = colorUnlockScore(k.color, themeId);
    return at > previousBest && at <= newBest;
  });
}
