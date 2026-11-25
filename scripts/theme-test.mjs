/** Theme tests. Run with: npm run test:theme */
import { THEMES, THEME_LIST, getTheme, DEFAULT_THEME } from '../src/systems/theme/themes.js';
import { AVATARS, AVATAR_SPECIES, avatarFor, collectionProgress, isAvatarUnlocked, resolveAvatar } from '../src/systems/avatars/avatars.js';
import { colorUnlockScore, newlyUnlocked } from '../src/systems/skins/skins.js';
import { useGameStore } from '../src/store/useGameStore.js';
import { createGameSim } from '../src/systems/game/createGameSim.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
};

const hex = /^#[0-9a-f]{6}$/i;
const lum = (h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

check('two themes: red and blue', THEME_LIST.length === 2 && THEMES.red && THEMES.blue && DEFAULT_THEME === 'red');
check('unknown theme falls back to red', getTheme('nope').id === 'red');

// Every theme defines every scene colour, so no component can read an undefined one.
const keys = Object.keys(THEMES.red.scene).sort().join();
for (const t of THEME_LIST) {
  check(`${t.id}: same scene keys as red`, Object.keys(t.scene).sort().join() === keys);
  const s = t.scene;
  const flat = [s.bg, s.fog, s.ambient, s.hemiSky, s.hemiGround, s.key, ...s.sky, s.groundBase, s.groundEmissive, ...s.peaks, s.peakEmissive,
    s.column.color, s.column.emissive, s.column.cap, s.block.color, s.block.emissive, s.block.cap, s.rock.color, s.rock.emissive,
    s.orbCore, s.orbHalo, s.ember, s.edgeWarn, s.ringA, s.ringB, t.swatch];
  check(`${t.id}: all colours are valid hex`, flat.every((c) => hex.test(c)), flat.filter((c) => !hex.test(c)).join());
  check(`${t.id}: has copy, and does not choose the bird's colour`, !!t.copy.over && !!t.copy.lava && !('freeSkin' in t));
  // Fairness: obstacles and their caps must stand out from the background in every theme.
  check(`${t.id}: obstacle caps stand out from the background`, contrast(s.column.cap, s.bg) > 6 && contrast(s.block.cap, s.bg) > 5, `${contrast(s.column.cap, s.bg).toFixed(1)}`);
  check(`${t.id}: obstacle bodies are not lost in the sky`, contrast(s.column.color, s.sky[1]) > 1.4 && contrast(s.rock.color, s.sky[1]) > 1.4);
  check(`${t.id}: orbs are bright`, contrast(s.orbCore, s.bg) > 10);
}
check('themes look different', THEMES.red.scene.bg !== THEMES.blue.scene.bg && THEMES.red.scene.column.cap !== THEMES.blue.scene.column.cap);

// Skins: a bird's colour is its own choice and never follows the theme. Fire is free for every bird in every theme; Blue and White unlock by score.
for (const t of THEME_LIST) {
  for (const sp of AVATAR_SPECIES) {
    const fire = avatarFor(sp.id, 'fire');
    check(`${t.id}/${sp.id}: Fire is free`, isAvatarUnlocked(fire, 0, t.id));
    check(`${t.id}/${sp.id}: Blue is locked at 0, even in the blue theme`, !isAvatarUnlocked(avatarFor(sp.id, 'blue'), 0, t.id));
    check(`${t.id}/${sp.id}: a locked skin falls back to Fire`, resolveAvatar(`${sp.id}-white`, 0, t.id).id === fire.id && resolveAvatar(`${sp.id}-blue`, 0, t.id).id === fire.id);
  }
  check(`${t.id}: one free skin per bird at the start`, collectionProgress(0, {}, t.id).unlocked === AVATAR_SPECIES.length);
  check(`${t.id}: everything unlocked eventually`, collectionProgress(1e9, {}, t.id).unlocked === AVATARS.length);
}
check('unlock scores are the same in both themes: Fire 0, Blue 600, White 1500', ['red', 'blue'].every((t) => colorUnlockScore('fire', t) === 0 && colorUnlockScore('blue', t) === 600 && colorUnlockScore('white', t) === 1500));
check('unlock messages do not depend on the theme', newlyUnlocked(0, 700, 'blue').map((k) => k.name).join() === 'Blue' && newlyUnlocked(0, 700, 'red').map((k) => k.name).join() === 'Blue');

// Store: the theme never touches the bird or the run.
const st = () => useGameStore.getState();
st().selectSkin('morpho-fire');
st().setTheme('blue');
check('switching theme does not change the bird (species or colour)', st().theme === 'blue' && st().skinId === 'morpho-fire', st().skinId);
st().selectSkin('morpho-blue');
check('a locked colour cannot be chosen, even in the blue theme', st().skinId === 'morpho-fire');
st().setTheme('red');
check('and switching back changes nothing either', st().skinId === 'morpho-fire');
st().setTheme('nope');
check('bad theme id is ignored', st().theme === 'red');

// Gameplay is identical in every theme: the sim has no theme input.
const runIn = (themeId) => {
  st().setTheme(themeId);
  const sim = createGameSim();
  sim.reset(3);
  sim.flap();
  for (let i = 0; i < 400; i++) {
    if (sim.bird.vy < 0 && sim.bird.y < 0.5) sim.flap();
    sim.step(1 / 120);
  }
  return [sim.distance, sim.bird.y, sim.orbsCollected, sim.phase].join();
};
check('same run in red and blue', runIn('red') === runIn('blue'));

console.log(failures ? `\n${failures} failed` : '\ntheme tests passed');
process.exit(failures ? 1 : 0);
