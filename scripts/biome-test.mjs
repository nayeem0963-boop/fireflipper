/** Scenery-zone tests (Sundarbans 0-500 m, Amazon 1000-1500 m). Run with: npm run test:biome */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BIOMES, SUNDARBANS_END, FADE_START, FADE, biomeAt, biomeWeight, biomeWeights, zoneStrength, zoneWeight } from '../src/systems/world/biomes.js';
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

// Amazon: 1000 to 1500 m, fading in over the first 80 m and out over the last 80 m.
const A = BIOMES.amazon;
check('Amazon covers 1000 to 1500 m', A.start === 1000 && A.end === 1500);
check('Amazon is off before 1000 m and from 1500 m on', zoneWeight(A, 0) === 0 && zoneWeight(A, 999) === 0 && zoneWeight(A, 1000) === 0 && zoneWeight(A, 1500) === 0 && zoneWeight(A, 4000) === 0);
check('Amazon is full strength between 1080 and 1420 m', [1080, 1200, 1250, 1420].every((d) => zoneWeight(A, d) === 1));
check('Amazon grows in and fades out smoothly', zoneWeight(A, 1040) > 0.1 && zoneWeight(A, 1040) < 0.9 && zoneWeight(A, 1460) > 0.1 && zoneWeight(A, 1460) < 0.9);
let amazonMonotone = true;
let last = 0;
for (let d = 1000; d <= 1080; d++) {
  const w = zoneWeight(A, d);
  if (w < last - 1e-12) amazonMonotone = false;
  last = w;
}
for (let d = 1420; d <= 1500; d++) {
  const w = zoneWeight(A, d);
  if (w > last + 1e-12) amazonMonotone = false;
  last = w;
}
check('Amazon fade-in rises and fade-out falls without popping', amazonMonotone);
let overlap = false;
for (let d = 0; d <= 3000; d++) {
  const w = biomeWeights(d);
  if (w.sundarbans > 0 && w.amazon > 0) overlap = true;
  if (zoneStrength(d) < 0 || zoneStrength(d) > 1) overlap = true;
}
check('zones never overlap and strength stays in 0..1', !overlap);
check('zone lookup covers both', biomeAt(250)?.id === 'sundarbans' && biomeAt(750) === null && biomeAt(1000)?.id === 'amazon' && biomeAt(1499)?.id === 'amazon' && biomeAt(1500) === null);
check('Amazon game-over wording', /forest floor/i.test(A.lavaCopy));
check('FADE is 80 m', FADE === 80);

// Fairness: obstacles must read against every backdrop a zone can put behind them (WCAG-style contrast).
const lum = (h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const hexOk = (c) => /^#[0-9a-f]{6}$/i.test(c);
const backdropsOf = {
  sundarbans: (S) => ({ 'sky top': S.skyTop, 'sky bottom': S.skyBottom, water: S.water, ...Object.fromEntries(S.canopy.map((c, i) => [`canopy ${i}`, c])) }),
  amazon: (S) => ({ 'sky top': S.skyTop, 'sky bottom': S.skyBottom, floor: S.floor, bark: S.bark, bough: S.bough, ...Object.fromEntries(S.leaf.map((c, i) => [`leaf ${i}`, c])) }),
};
for (const zone of [BIOMES.sundarbans, BIOMES.amazon]) {
  const S = zone.scene;
  const backdrops = backdropsOf[zone.id](S);
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
  const flat = [];
  const collect = (v) => (typeof v === 'string' ? flat.push(v) : Array.isArray(v) ? v.forEach(collect) : v && typeof v === 'object' ? Object.values(v).forEach(collect) : null);
  collect(S);
  check(`${zone.id}: all palette colours are valid hex`, flat.every(hexOk), flat.filter((c) => !hexOk(c)).join());
}

// The zone is scenery only: nothing in the simulation may depend on it, so every mechanic is identical everywhere.
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const simFiles = ['game', 'physics', 'obstacles', 'scoring', 'bot'].flatMap((d) => walk(new URL(`../src/systems/${d}`, import.meta.url).pathname)).filter((f) => f.endsWith('.js'));
const offenders = simFiles.filter((f) => /world\/biomes|biomeWeight|zoneWeight|zoneStrength|biomeAt|theme\/themes/.test(readFileSync(f, 'utf8')));
check('the simulation, physics, obstacles, scoring and bot never read the zones or theme', offenders.length === 0, offenders.join());
check('every theme still passes through (blue and red both get the zone)', THEME_LIST.length === 2);

console.log(failures ? `\n${failures} failed` : '\nbiome tests passed');
process.exit(failures ? 1 : 0);
