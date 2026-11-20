/**
 * Visual themes. Pure data plus two tiny DOM helpers. A theme changes only how the game LOOKS: interface colours
 * (CSS variables, see styles/global.css), the scenery's palette, and which bird skin colour is free. Nothing in a
 * theme reaches the simulation, so physics, obstacles, scoring and fairness are identical in every theme.
 *
 *  - 'red'  (Ember): the original look, a lava valley.
 *  - 'blue' (Frost): the same valley as an ice cavern.
 *
 * `scene` colours are hex strings for three.js; `sky` and `grid` feed the canvas textures. `freeSkin` is the bird
 * colour that is unlocked from the start in this theme (the other warm/cool one unlocks with the best score, white
 * later), so every bird starts out matching the theme.
 */
export const THEMES = Object.freeze({
  red: Object.freeze({
    id: 'red',
    name: 'Red',
    flavour: 'Ember Valley',
    swatch: '#ff5a14',
    freeSkin: 'fire',
    /** Plain glow textures are warm-tinted in the original look; blue needs a neutral white glow. */
    neutralGlow: false,
    /** Game-over wording that matches the setting (the simulation's cause codes are the same in every theme). */
    copy: Object.freeze({ over: 'Scorched!', lava: 'Burned in the lava' }),
    scene: Object.freeze({
      bg: '#0b0907',
      fog: '#120806',
      ambient: '#ffb27a',
      hemiSky: '#ff9a4a',
      hemiGround: '#0a0503',
      key: '#ffd8b0',
      sky: ['#0b0907', '#1c0b06', '#5a1a08', '#c2440f', '#ff8a2a'],
      groundBase: '#140a06',
      grid: '255, 120, 40',
      groundEmissive: '#ff6a1a',
      peaks: ['#1d0c07', '#2a1009', '#3a160b'],
      peakEmissive: '#3a1206',
      column: { color: '#6b4433', emissive: '#3a1004', cap: '#ff8a2a' },
      block: { color: '#5e3b2c', emissive: '#3a1004', cap: '#ff7a1f' },
      rock: { color: '#7a4b36', emissive: '#4a1405' },
      orbCore: '#fff0b8',
      orbHalo: '#ff8a24',
      // On a pale daytime backdrop (Sundarbans, Volcanic Coast) an additive glow washes out, so orbs use these saturated colours instead.
      orbCoreDay: '#ffb21a',
      orbHaloDay: '#cf3208',
      ember: '#ffae4a',
      edgeWarn: '#ff7a24',
      crash: [1.0, 0.42, 0.1],
      ringA: '#ff8a2a',
      ringB: '#ffc46b',
    }),
  }),
  blue: Object.freeze({
    id: 'blue',
    name: 'Blue',
    flavour: 'Frost Cavern',
    swatch: '#2ea6ff',
    freeSkin: 'blue',
    neutralGlow: true,
    copy: Object.freeze({ over: 'Frozen!', lava: 'Plunged into the frost' }),
    scene: Object.freeze({
      bg: '#060b12',
      fog: '#07101c',
      ambient: '#8fc0ff',
      hemiSky: '#4aa0ff',
      hemiGround: '#04080e',
      key: '#cfe6ff',
      sky: ['#060b12', '#0a1a2e', '#10407a', '#2a7fd0', '#8fdcff'],
      groundBase: '#06101a',
      grid: '70, 160, 255',
      groundEmissive: '#2a8cff',
      peaks: ['#0a1830', '#0f2444', '#173458'],
      peakEmissive: '#0a2a55',
      column: { color: '#4a6d96', emissive: '#0a2a55', cap: '#7fdcff' },
      block: { color: '#41607f', emissive: '#0a2a55', cap: '#55c0ff' },
      rock: { color: '#56789d', emissive: '#0e3166' },
      orbCore: '#e8fbff',
      orbHalo: '#4aa8ff',
      orbCoreDay: '#4db8ff',
      orbHaloDay: '#0a5fd9',
      ember: '#8fd8ff',
      edgeWarn: '#4aa8ff',
      crash: [0.35, 0.75, 1.0],
      ringA: '#3aa0ff',
      ringB: '#a8dcff',
    }),
  }),
});

export const THEME_LIST = Object.freeze([THEMES.red, THEMES.blue]);
export const DEFAULT_THEME = 'red';

export const getTheme = (id) => THEMES[id] ?? THEMES[DEFAULT_THEME];

/** Browser address-bar colour per theme. */
const BAR_COLOR = { red: '#0b0907', blue: '#060b12' };

/** Point the page's CSS variables (via `data-theme`) and the browser bar at a theme. Safe outside a browser. */
export function applyTheme(id) {
  if (typeof document === 'undefined') return;
  const theme = getTheme(id);
  document.documentElement.dataset.theme = theme.id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', BAR_COLOR[theme.id]);
}
