/**
 * Colour palettes for the Art Lab. A palette is four artwork colours (light to dark mixes are up to each piece),
 * an accent used for rims and glows, a two-stop backdrop gradient and a light tint. Pure data.
 */
export const PALETTES = Object.freeze([
  {
    id: 'ember',
    name: 'Ember',
    colors: ['#ff5a14', '#ffb347', '#ffd36b', '#a3120a'],
    accent: '#ff7a2a',
    bg: ['#0b0907', '#2a1208'],
    light: '#ffd2a0',
  },
  {
    id: 'frost',
    name: 'Frost',
    colors: ['#2ea6ff', '#9fe8ff', '#d8f6ff', '#0b3fb8'],
    accent: '#3aa8ff',
    bg: ['#060b12', '#0c2038'],
    light: '#cfe8ff',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    colors: ['#37f2a5', '#7a5cff', '#ff5fd2', '#1c8f6a'],
    accent: '#6ff0c8',
    bg: ['#070a10', '#14102a'],
    light: '#e0d4ff',
  },
  {
    id: 'mono',
    name: 'Mono',
    colors: ['#f4f4f4', '#bdbdbd', '#8a8a8a', '#3a3a3a'],
    accent: '#ffffff',
    bg: ['#080808', '#1c1c1c'],
    light: '#ffffff',
  },
]);

export const DEFAULT_PALETTE_ID = PALETTES[0].id;

export function getPalette(id) {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}
