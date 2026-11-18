import { useGameStore } from '../store/useGameStore.js';
import { resolveAvatar } from '../systems/avatars/avatars.js';

/** The bird the player is flying as: the selected skin, or that bird's free Fire colour while it is locked. */
export function useSkin() {
  const skinId = useGameStore((s) => s.skinId);
  const bestScore = useGameStore((s) => s.bestScore);
  return resolveAvatar(skinId, bestScore);
}
