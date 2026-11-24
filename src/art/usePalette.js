import { useMemo } from 'react';
import { Color } from 'three';

/** The palette as three.js colours (made once per palette): `colors` (the four artwork colours), `accent` and `light`. */
export function usePaletteColors(palette) {
  return useMemo(
    () => ({ colors: palette.colors.map((c) => new Color(c)), accent: new Color(palette.accent), light: new Color(palette.light) }),
    [palette],
  );
}
