import { useGameStore } from '../store/useGameStore.js';
import { resolveSkin } from '../systems/skins/skins.js';

/** The skin currently worn by the bird (the selected one, or the default while it is locked). */
export function useSkin() {
  const skinId = useGameStore((s) => s.skinId);
  const bestScore = useGameStore((s) => s.bestScore);
  return resolveSkin(skinId, bestScore);
}
