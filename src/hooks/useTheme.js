import { useGameStore } from '../store/useGameStore.js';
import { getTheme } from '../systems/theme/themes.js';

/** The active theme object (scene palette, names). Re-renders only when the theme changes. */
export function useTheme() {
  return getTheme(useGameStore((s) => s.theme));
}
