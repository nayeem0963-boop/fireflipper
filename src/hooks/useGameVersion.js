import { useGameStore } from '../store/useGameStore.js';
import { getVersion } from '../systems/versions/versions.js';

/** The selected game version (see systems/versions): decides how the player is drawn, never how the game plays. */
export function useGameVersion() {
  return getVersion(useGameStore((s) => s.versionId));
}
