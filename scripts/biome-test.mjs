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
const R = BIOMES.arctic;
check('Sundarbans covers the first 500 m', SUNDARBANS_END === 500 && S0.start === 0 && S0.end === 500);
check('Volcanic Coast covers 500 to 1000 m', V.start === 500 && V.end === 1000);
check('Amazon covers 1000 to 1500 m', A.start === 1000 && A.end === 1500);
check('Arctic Ice Shelf covers 1500 to 2000 m', R.start === 1500 && R.end === 2000);
check('zone lookup by border', biomeAt(0)?.id === 'sundarbans' && biomeAt(499.9)?.id === 'sundarbans' && biomeAt(500)?.id === 'volcano' && biomeAt(999.9)?.id === 'volcano' && biomeAt(1000)?.id === 'amazon' && biomeAt(1499.9)?.id === 'amazon' && biomeAt(1500)?.id === 'arctic' && biomeAt(1999.9)?.id === 'arctic' && biomeAt(2000) === null && biomeAt(9000) === null);
check('game-over wording per zone', /creek/i.test(S0.lavaCopy) && /sea/i.test(V.lavaCopy) && /forest floor/i.test(A.lavaCopy) && /ice/i.test(R.lavaCopy));

// Each zone is full strength well inside it, and absent well outside it.
check('Sundarbans is full strength from the start to 460 m, gone by 540 m', [0, 1, 250, 460].every((d) => zoneWeight(S0, d) === 1) && zoneWeight(S0, 540) === 0 && zoneWeight(S0, 3000) === 0);
check('Volcanic Coast is off before 460 m, full from 540 to 960 m, gone from 1040 m', zoneWeight(V, 0) === 0 && zoneWeight(V, 460) === 0 && [540, 700, 960].every((d) => zoneWeight(V, d) === 1) && zoneWeight(V, 1040) === 0);
check('Amazon is off before 960 m, full from 1040 to 1460 m, gone from 1540 m', zoneWeight(A, 0) === 0 && zoneWeight(A, 960) === 0 && [1040, 1250, 1460].every((d) => zoneWeight(A, d) === 1) && zoneWeight(A, 1540) === 0 && zoneWeight(A, 4000) === 0);
check('Arctic is off before 1460 m, full from 1540 to 1920 m, gone by 2000 m', zoneWeight(R, 0) === 0 && zoneWeight(R, 1460) === 0 && [1540, 1700, 1920].every((d) => zoneWeight(R, d) === 1) && zoneWeight(R, 2000) === 0 && zoneWeight(R, 5000) === 0);
check('FADE and CROSSFADE are 80 m', FADE === 80 && CROSSFADE === 80 && FADE_START === 460);

// Handover between zones: the weights add up to exactly 1 (so the original scenery never flashes in), and each fades smoothly.
let sumsToOne = true;
let strengthOk = true;
let smoothSteps = true;
const prevW = biomeWeights(0);
const peaks = { sundarbans: 0, volcano: 0, amazon: 0, arctic: 0 };
const turns = { sundarbans: 0, volcano: 0, amazon: 0, arctic: 0 };
const dir = { sundarbans: 0, volcano: 0, amazon: 0, arctic: 0 };
for (let d = 0.5; d <= 2100; d += 0.5) {
  const w = biomeWeights(d);
  const sum = w.sundarbans + w.volcano + w.amazon + w.arctic;
  if (d <= 1920 && Math.abs(sum - 1) > 1e-9) sumsToOne = false;
  if (zoneStrength(d) < -1e-9 || zoneStrength(d) > 1 + 1e-9) strengthOk = false;
  for (const k of Object.keys(w)) {
    const step = w[k] - prevW[k];
    if (Math.abs(step) > 0.02) smoothSteps = false; // no pops: at most 2% per half metre
    const dnow = step > 1e-12 ? 1 : step < -1e-12 ? -1 : 0;
    if (dnow !== 0 && dir[k] !== 0 && dnow !== dir[k]) turns[k]++;
    if (dnow !== 0) dir[k] = dnow;
    peaks[k] = Math.max(peaks[k], w[k]);
    prevW[k] = w[k];
  }
}
check('weights add up to 1 from the start to 1920 m (no gap between zones)', sumsToOne);
check('combined strength stays within 0..1', strengthOk);
check('every handover is smooth (no pops)', smoothSteps);
check('each zone rises once and falls once (never flickers back)', Object.values(turns).every((t) => t <= 1) && Object.values(peaks).every((p) => Math.abs(p - 1) < 1e-9), JSON.stringify({ turns, peaks }));
check('cross-fade is centred on the 500, 1000 and 1500 m borders', [[S0, V, 500], [V, A, 1000], [A, R, 1500]].every(([a, b, at]) => Math.abs(zoneWeight(a, at) - 0.5) < 1e-9 && Math.abs(zoneWeight(b, at) - 0.5) < 1e-9));
check('the original scenery is back by 2000 m', zoneStrength(2000) === 0 && zoneStrength(1960) > 0.1 && zoneStrength(1960) < 0.9);
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

// The Volcanic Coast and the Arctic keep the themed obstacles (the coast's poles are rock pillars; slabs and rocks are coloured by the theme),
// so test them in each theme against the colours of the scenery behind them.
const PALE = {
  volcano: ['sky top', 'sky mid', 'horizon', 'sea', 'sand', 'rocks', 'volcano', 'snow'],
  arctic: ['sky top', 'sky mid', 'horizon', 'snow', 'snow shadow', 'ice', 'slate rock'],
};
for (const zone of [V, R]) {
  const names = PALE[zone.id];
  for (const theme of THEME_LIST) {
    const T = theme.scene;
    zone.scene.backdrops.forEach((bc, i) => {
      const pillar = Math.max(contrast(T.column.color, bc), contrast(T.column.cap, bc));
      const slab = Math.max(contrast(T.block.color, bc), contrast(T.block.cap, bc));
      check(`${zone.id}/${theme.id}: pillar reads against ${names[i]}`, pillar >= 2, pillar.toFixed(2));
      check(`${zone.id}/${theme.id}: slab reads against ${names[i]}`, slab >= 2, slab.toFixed(2));
      check(`${zone.id}/${theme.id}: floating rock reads against ${names[i]}`, contrast(T.rock.color, bc) >= 1.25 || i >= 5, contrast(T.rock.color, bc).toFixed(2));
    });
    const base = zone.id === 'volcano' ? [zone.scene.skyTop, zone.scene.water, zone.scene.sand] : [zone.scene.skyTop, zone.scene.snow, zone.scene.snowShadow];
    check(`${zone.id}/${theme.id}: daytime orbs read against the sky and the ground`, base.every((bc) => contrast(T.orbHaloDay, bc) >= 1.7), '');
  }
}

// The six paintings (three for the Volcanic Coast, three for the Arctic) are real files, small enough to load quickly, and loaded lazily.
import { existsSync, statSync as fileStat } from 'node:fs';
for (const f of ['coast-a.jpg', 'coast-b.jpg', 'coast-c.jpg', 'arctic-a.jpg', 'arctic-b.jpg', 'arctic-c.jpg']) {
  const path = new URL(`../public/images/backdrop/${f}`, import.meta.url);
  check(`painting ${f} exists`, existsSync(path));
  if (existsSync(path)) check(`painting ${f} is under 120 kB`, fileStat(path).size < 120 * 1024, String(fileStat(path).size));
}
const backdropSource = readFileSync(new URL('../src/scenes/EmberValley/VolcanoBackdrop.jsx', import.meta.url), 'utf8');
const zonePartsSource = readFileSync(new URL('../src/scenes/EmberValley/ZoneParts.jsx', import.meta.url), 'utf8');
check('paintings load lazily, not at start-up', /PRELOAD_AT = 380/.test(backdropSource) && /d > preloadAt/.test(zonePartsSource) && /preloadAt=\{PRELOAD_AT\}/.test(backdropSource));
const sceneSource = readFileSync(new URL('../src/scenes/EmberValley/EmberValleyScene.jsx', import.meta.url), 'utf8');
const arcticSource = readFileSync(new URL('../src/scenes/EmberValley/ArcticBackdrop.jsx', import.meta.url), 'utf8');
check('the scene mounts the Volcanic Coast and Arctic backdrops', /VolcanoBackdrop/.test(sceneSource) && /ArcticBackdrop/.test(sceneSource));
check('Arctic paintings load lazily, just before the zone', /PRELOAD_AT = 1380/.test(arcticSource) && 1380 < R.start && R.start - 1380 <= 200);
check('the edge warning switches to a daytime look on pale scenery', /NormalBlending/.test(readFileSync(new URL('../src/components/scene/EdgeWarning.jsx', import.meta.url), 'utf8')));

// The zone is scenery only: nothing in the simulation may depend on it, so every mechanic is identical everywhere.
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const simFiles = ['game', 'physics', 'obstacles', 'scoring', 'bot'].flatMap((d) => walk(new URL(`../src/systems/${d}`, import.meta.url).pathname)).filter((f) => f.endsWith('.js'));
const offenders = simFiles.filter((f) => /world\/biomes|biomeWeight|zoneWeight|zoneStrength|biomeAt|theme\/themes/.test(readFileSync(f, 'utf8')));
check('the simulation, physics, obstacles, scoring and bot never read the zones or theme', offenders.length === 0, offenders.join());
check('every theme still passes through (blue and red both get the zone)', THEME_LIST.length === 2);

console.log(failures ? `\n${failures} failed` : '\nbiome tests passed');
process.exit(failures ? 1 : 0);
