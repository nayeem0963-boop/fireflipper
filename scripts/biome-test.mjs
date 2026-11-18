/** Scenery-zone tests (Sundarbans, first 500 m). Run with: npm run test:biome */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BIOMES, SUNDARBANS_END, FADE_START, biomeAt, biomeWeight } from '../src/systems/world/biomes.js';
import { THEME_LIST } from '../src/systems/theme/themes.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
};

check('Sundarbans covers the first 500 m', SUNDARBANS_END === 500 && BIOMES.sundarbans.start === 0 && BIOMES.sundarbans.end === 500);
check('full strength at the start and up to the fade', biomeWeight(0) === 1 && biomeWeight(FADE_START) === 1 && biomeWeight(250) === 1);
check('gone from 500 m on', biomeWeight(500) === 0 && biomeWeight(501) === 0 && biomeWeight(3000) === 0);
let monotone = true;
let prev = 1;
for (let d = 0; d <= 600; d += 1) {
  const w = biomeWeight(d);
  if (w > prev + 1e-12 || w < 0 || w > 1) monotone = false;
  prev = w;
}
check('the fade is smooth and monotone (no popping)', monotone);
check('fade spans 80 m', biomeWeight(460) > 0.1 && biomeWeight(460) < 0.9);
check('zone lookup', biomeAt(0)?.id === 'sundarbans' && biomeAt(499.9)?.id === 'sundarbans' && biomeAt(500) === null);
check('game-over wording for the zone', /creek/i.test(BIOMES.sundarbans.lavaCopy));

// Fairness: obstacles and orbs must read against the Sundarbans greens and water (WCAG-style contrast).
const lum = (h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const S = BIOMES.sundarbans.scene;
// Each obstacle shows a body and a cap, so what matters is the better of the two against every backdrop it can cross.
const backdrops = { 'sky top': S.skyTop, 'sky bottom': S.skyBottom, water: S.water, ...Object.fromEntries(S.canopy.map((c, i) => [`canopy ${i}`, c])) };
for (const [name, o] of [['column', S.column], ['block', S.block]]) {
  for (const [bn, bc] of Object.entries(backdrops)) {
    const best = Math.max(contrast(o.color, bc), contrast(o.cap, bc));
    check(`${name} reads against ${bn}`, best >= 2, best.toFixed(2));
  }
}
for (const [bn, bc] of Object.entries(backdrops)) {
  const need = bn.startsWith('canopy') ? 1.2 : bn === 'water' ? 1.25 : 1.5; // a single natural brown cannot do better against mid-tone water
  check(`rock reads against ${bn}`, contrast(S.rock.color, bc) >= need, contrast(S.rock.color, bc).toFixed(2));
}
check('all palette colours are valid hex', [S.skyTop, S.skyBottom, S.fog, S.bg, S.ambient, S.hemiSky, S.hemiGround, S.key, S.water, S.waterLight, S.mud, S.mudDark, S.bark, S.root, ...S.canopy, S.column.color, S.column.cap, S.block.color, S.block.cap, S.rock.color].every((c) => /^#[0-9a-f]{6}$/i.test(c)));

// The zone is scenery only: nothing in the simulation may depend on it, so every mechanic is identical everywhere.
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const simFiles = ['game', 'physics', 'obstacles', 'scoring', 'bot'].flatMap((d) => walk(new URL(`../src/systems/${d}`, import.meta.url).pathname)).filter((f) => f.endsWith('.js'));
const offenders = simFiles.filter((f) => /world\/biomes|biomeWeight|biomeAt|theme\/themes/.test(readFileSync(f, 'utf8')));
check('the simulation, physics, obstacles, scoring and bot never read the zone or theme', offenders.length === 0, offenders.join());
check('every theme still passes through (blue and red both get the zone)', THEME_LIST.length === 2);

console.log(failures ? `\n${failures} failed` : '\nbiome tests passed');
process.exit(failures ? 1 : 0);
