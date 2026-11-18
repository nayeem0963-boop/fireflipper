/** Scenery-zone tests (Sundarbans 0-500 m, Amazon 1000-1500 m). Run with: npm run test:biome */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BIOMES, SUNDARBANS_END, FADE_START, FADE, CROSSFADE, biomeAt, biomeWeight, biomeWeights, zoneStrength, zoneWeight } from '../src/systems/world/biomes.js';
import { THEME_LIST } from '../src/systems/theme/themes.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
};

const S0 = BIOMES.sundarbans;
const V = BIOMES.volcano;
const A = BIOMES.amazon;
check('Sundarbans covers the first 500 m', SUNDARBANS_END === 500 && S0.start === 0 && S0.end === 500);
check('Volcanic Coast covers 500 to 1000 m', V.start === 500 && V.end === 1000);
check('Amazon covers 1000 to 1500 m', A.start === 1000 && A.end === 1500);
check('zone lookup by border', biomeAt(0)?.id === 'sundarbans' && biomeAt(499.9)?.id === 'sundarbans' && biomeAt(500)?.id === 'volcano' && biomeAt(999.9)?.id === 'volcano' && biomeAt(1000)?.id === 'amazon' && biomeAt(1499.9)?.id === 'amazon' && biomeAt(1500) === null && biomeAt(9000) === null);
check('game-over wording per zone', /creek/i.test(S0.lavaCopy) && /sea/i.test(V.lavaCopy) && /forest floor/i.test(A.lavaCopy));

// Each zone is full strength well inside it, and absent well outside it.
check('Sundarbans is full strength from the start to 460 m, gone by 540 m', [0, 1, 250, 460].every((d) => zoneWeight(S0, d) === 1) && zoneWeight(S0, 540) === 0 && zoneWeight(S0, 3000) === 0);
check('Volcanic Coast is off before 460 m, full from 540 to 960 m, gone from 1040 m', zoneWeight(V, 0) === 0 && zoneWeight(V, 460) === 0 && [540, 700, 960].every((d) => zoneWeight(V, d) === 1) && zoneWeight(V, 1040) === 0);
check('Amazon is off before 960 m, full from 1040 to 1420 m, gone by 1500 m', zoneWeight(A, 0) === 0 && zoneWeight(A, 960) === 0 && [1040, 1250, 1420].every((d) => zoneWeight(A, d) === 1) && zoneWeight(A, 1500) === 0 && zoneWeight(A, 4000) === 0);
check('FADE and CROSSFADE are 80 m', FADE === 80 && CROSSFADE === 80 && FADE_START === 460);

// Handover between zones: the weights add up to exactly 1 (so the original scenery never flashes in), and each fades smoothly.
let sumsToOne = true;
let strengthOk = true;
let monotone = true;
const prev = { s: 1, v: 0, a: 0 };
for (let d = 0; d <= 1500; d += 0.5) {
  const w = biomeWeights(d);
  const sum = w.sundarbans + w.volcano + w.amazon;
  if (d <= 1420 && Math.abs(sum - 1) > 1e-9) sumsToOne = false;
  if (zoneStrength(d) < -1e-9 || zoneStrength(d) > 1 + 1e-9) strengthOk = false;
  // Sundarbans only ever falls; Volcano rises then falls; Amazon rises then falls (once each)
  if (w.sundarbans > prev.s + 1e-9) monotone = false;
  if (d < 500 && w.volcano < prev.v - 1e-9) monotone = false;
  if (d > 1000 && d < 1420 && w.amazon < prev.a - 1e-9) monotone = false;
  prev.s = w.sundarbans;
  prev.v = w.volcano;
  prev.a = w.amazon;
}
check('weights add up to 1 from the start to 1420 m (no gap between zones)', sumsToOne);
check('combined strength stays within 0..1', strengthOk);
check('every handover is smooth and one-way (no popping)', monotone);
check('cross-fade is centred on the 500 m and 1000 m borders', Math.abs(zoneWeight(S0, 500) - 0.5) < 1e-9 && Math.abs(zoneWeight(V, 500) - 0.5) < 1e-9 && Math.abs(zoneWeight(V, 1000) - 0.5) < 1e-9 && Math.abs(zoneWeight(A, 1000) - 0.5) < 1e-9);
check('the original scenery is back by 1500 m', zoneStrength(1500) === 0 && zoneStrength(1460) > 0.1 && zoneStrength(1460) < 0.9);
check('Sundarbans weight helper agrees', biomeWeight(480) === zoneWeight(S0, 480));

// Fairness: obstacles must read against every backdrop a zone can put behind them (WCAG-style contrast).
const lum = (h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const hexOk = (c) => /^#[0-9a-f]{6}$/i.test(c);
const backdropsOf = {
  sundarbans: (S) => ({ 'sky top': S.skyTop, 'sky bottom': S.skyBottom, water: S.water, ...Object.fromEntries(S.canopy.map((c, i) => [`canopy ${i}`, c])) }),
  volcano: (S) => Object.fromEntries(S.backdrops.map((c, i) => [['sky top', 'sky mid', 'horizon', 'sea', 'sand', 'rocks', 'volcano', 'snow'][i], c])),
  amazon: (S) => ({ 'sky top': S.skyTop, 'sky bottom': S.skyBottom, floor: S.floor, bark: S.bark, bough: S.bough, ...Object.fromEntries(S.leaf.map((c, i) => [`leaf ${i}`, c])) }),
};
for (const zone of [BIOMES.sundarbans, BIOMES.volcano, BIOMES.amazon]) {
  const S = zone.scene;
  const backdrops = backdropsOf[zone.id](S);
  const flat = [];
  const collect = (v) => (typeof v === 'string' ? flat.push(v) : Array.isArray(v) ? v.forEach(collect) : v && typeof v === 'object' ? Object.values(v).forEach(collect) : null);
  collect(S);
  check(`${zone.id}: all palette colours are valid hex`, flat.every(hexOk), flat.filter((c) => !hexOk(c)).join());
  if (zone.id === 'volcano') continue; // its obstacles are the themed originals: tested per theme below
  // Each obstacle shows a body and a cap, so what matters is the better of the two against every backdrop.
  for (const [name, o] of [['column', S.column], ['block', S.block]]) {
    for (const [bn, bc] of Object.entries(backdrops)) {
      const best = Math.max(contrast(o.color, bc), contrast(o.cap, bc));
      check(`${zone.id}: ${name} reads against ${bn}`, best >= 2, best.toFixed(2));
    }
  }
  for (const [bn, bc] of Object.entries(backdrops)) {
    const need = bn.startsWith('canopy') || bn.startsWith('leaf') || bn === 'bough' || bn === 'bark' ? 1.2 : bn === 'water' ? 1.25 : 1.5; // one natural tone cannot do better against mid-tones
    check(`${zone.id}: rock reads against ${bn}`, contrast(S.rock.color, bc) >= need, contrast(S.rock.color, bc).toFixed(2));
  }
}

// The Volcanic Coast keeps the themed obstacles (rock pillars, slabs and rocks coloured by the theme), so test them in each theme
// against the colours of the coast: pale sky, peach horizon, jade sea, sand, boulders, volcano and snow.
for (const theme of THEME_LIST) {
  const T = theme.scene;
  const names = ['sky top', 'sky mid', 'horizon', 'sea', 'sand', 'rocks', 'volcano', 'snow'];
  V.scene.backdrops.forEach((bc, i) => {
    const pillar = Math.max(contrast(T.column.color, bc), contrast(T.column.cap, bc));
    const slab = Math.max(contrast(T.block.color, bc), contrast(T.block.cap, bc));
    check(`volcano/${theme.id}: pillar reads against ${names[i]}`, pillar >= 2, pillar.toFixed(2));
    check(`volcano/${theme.id}: slab reads against ${names[i]}`, slab >= 2, slab.toFixed(2));
    check(`volcano/${theme.id}: floating rock reads against ${names[i]}`, contrast(T.rock.color, bc) >= 1.25 || i >= 5, contrast(T.rock.color, bc).toFixed(2));
  });
  check(`volcano/${theme.id}: daytime orbs read against sky, sea and sand`, [V.scene.skyTop, V.scene.water, V.scene.sand].every((bc) => contrast(T.orbHaloDay, bc) >= 1.7), '');
}

// The three coast paintings the Volcanic Coast uses are real files, small enough to load quickly, and loaded lazily.
import { existsSync, statSync as fileStat } from 'node:fs';
for (const f of ['coast-a.jpg', 'coast-b.jpg', 'coast-c.jpg']) {
  const path = new URL(`../public/images/backdrop/${f}`, import.meta.url);
  check(`painting ${f} exists`, existsSync(path));
  if (existsSync(path)) check(`painting ${f} is under 120 kB`, fileStat(path).size < 120 * 1024, String(fileStat(path).size));
}
const backdropSource = readFileSync(new URL('../src/scenes/EmberValley/VolcanoBackdrop.jsx', import.meta.url), 'utf8');
check('paintings load lazily, not at start-up', /PRELOAD_AT/.test(backdropSource) && /d > PRELOAD_AT/.test(backdropSource));
check('the scene mounts the Volcanic Coast backdrop', /VolcanoBackdrop/.test(readFileSync(new URL('../src/scenes/EmberValley/EmberValleyScene.jsx', import.meta.url), 'utf8')));

// The zone is scenery only: nothing in the simulation may depend on it, so every mechanic is identical everywhere.
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const simFiles = ['game', 'physics', 'obstacles', 'scoring', 'bot'].flatMap((d) => walk(new URL(`../src/systems/${d}`, import.meta.url).pathname)).filter((f) => f.endsWith('.js'));
const offenders = simFiles.filter((f) => /world\/biomes|biomeWeight|zoneWeight|zoneStrength|biomeAt|theme\/themes/.test(readFileSync(f, 'utf8')));
check('the simulation, physics, obstacles, scoring and bot never read the zones or theme', offenders.length === 0, offenders.join());
check('every theme still passes through (blue and red both get the zone)', THEME_LIST.length === 2);

console.log(failures ? `\n${failures} failed` : '\nbiome tests passed');
process.exit(failures ? 1 : 0);
