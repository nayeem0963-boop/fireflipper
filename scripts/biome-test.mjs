/**
 * Scenery-zone tests (Red Rock Canyon 0-1500 m, Arctic 1500-2000 m, Celestial Realm 2000-3000 m, Rose Sky Palace 3000-5000 m).
 * Run with: npm run test:biome
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACTIVE_OBSTACLE_LOOKS, BIOMES, CROSSFADE, FADE, ZONE_IDS, biomeAt, biomeWeights, dominantZone, obstacleStyleAt, zoneStrength, zoneWeight,
} from '../src/systems/world/biomes.js';
import { THEME_LIST } from '../src/systems/theme/themes.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const K = BIOMES.canyon;
const R = BIOMES.arctic;
const C = BIOMES.celestial;
const P = BIOMES.palace;

// ------------------------------------------------------------------ ranges
check('Red Rock Canyon covers 0 to 1500 m', K.start === 0 && K.end === 1500);
check('Frosty Polar covers 1500 to 2000 m', R.start === 1500 && R.end === 2000);
check('Celestial Realm covers 2000 to 3000 m', C.start === 2000 && C.end === 3000);
check('Rose Sky Palace covers 3000 to 5000 m', P.start === 3000 && P.end === 5000);
check('four live zones, in order; the retired scenes are not among them', ZONE_IDS.join() === 'canyon,arctic,celestial,palace' && BIOMES.sundarbans.retired && BIOMES.amazon.retired);
check('zone lookup by border', biomeAt(0)?.id === 'canyon' && biomeAt(1499.9)?.id === 'canyon' && biomeAt(1500)?.id === 'arctic' && biomeAt(1999.9)?.id === 'arctic' && biomeAt(2000)?.id === 'celestial' && biomeAt(2999.9)?.id === 'celestial' && biomeAt(3000)?.id === 'palace' && biomeAt(4999.9)?.id === 'palace' && biomeAt(5000) === null && biomeAt(9000) === null);
check('game-over wording per zone', /canyon/i.test(K.lavaCopy) && /ice/i.test(R.lavaCopy) && /cloud/i.test(C.lavaCopy) && /pool/i.test(P.lavaCopy));

// Each zone is full strength well inside it, and absent well outside it.
check('Canyon is full strength from the start to 1460 m, gone from 1540 m', [0, 1, 250, 750, 1250, 1460].every((d) => zoneWeight(K, d) === 1) && zoneWeight(K, 1540) === 0 && zoneWeight(K, 6000) === 0);
check('Arctic is off before 1460 m, full from 1540 to 1960 m, gone from 2040 m', zoneWeight(R, 0) === 0 && zoneWeight(R, 1460) === 0 && [1540, 1700, 1960].every((d) => zoneWeight(R, d) === 1) && zoneWeight(R, 2040) === 0);
check('Celestial is off before 1960 m, full from 2040 to 2960 m, gone from 3040 m', zoneWeight(C, 0) === 0 && zoneWeight(C, 1960) === 0 && [2040, 2500, 2960].every((d) => zoneWeight(C, d) === 1) && zoneWeight(C, 3040) === 0);
check('Palace is off before 2960 m, full from 3040 to 4920 m, gone by 5000 m', zoneWeight(P, 0) === 0 && zoneWeight(P, 2960) === 0 && [3040, 4000, 4920].every((d) => zoneWeight(P, d) === 1) && zoneWeight(P, 5000) === 0 && zoneWeight(P, 9000) === 0);
check('FADE and CROSSFADE are 80 m', FADE === 80 && CROSSFADE === 80);

// Handover between zones: the weights add up to exactly 1 (so the original scenery never flashes in), and each fades smoothly.
let sumsToOne = true;
let strengthOk = true;
let smoothSteps = true;
const prevW = biomeWeights(0);
const blank = () => Object.fromEntries(ZONE_IDS.map((id) => [id, 0]));
const peaks = blank();
const turns = blank();
const dir = blank();
for (let d = 0.5; d <= 5100; d += 0.5) {
  const w = biomeWeights(d);
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  if (d <= 4920 && Math.abs(sum - 1) > 1e-9) sumsToOne = false;
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
check('weights add up to 1 from the start to 4920 m (no gap between zones)', sumsToOne);
check('combined strength stays within 0..1', strengthOk);
check('every handover is smooth (no pops)', smoothSteps);
check('each zone rises once and falls once (never flickers back)', Object.values(turns).every((t) => t <= 1) && Object.values(peaks).every((p) => Math.abs(p - 1) < 1e-9), JSON.stringify({ turns, peaks }));
check('cross-fade is centred on the 1500, 2000 and 3000 m borders', [[K, R, 1500], [R, C, 2000], [C, P, 3000]].every(([a, b, at]) => Math.abs(zoneWeight(a, at) - 0.5) < 1e-9 && Math.abs(zoneWeight(b, at) - 0.5) < 1e-9));
check('the run starts inside the canyon with no fade-in', zoneWeight(K, 0) === 1);
check('the original scenery is back by 5000 m', zoneStrength(5000) === 0 && zoneStrength(4960) > 0.1 && zoneStrength(4960) < 0.9);
check('dominant zone', dominantZone(10)?.id === 'canyon' && dominantZone(1700)?.id === 'arctic' && dominantZone(2500)?.id === 'celestial' && dominantZone(4000)?.id === 'palace' && dominantZone(6000) === null);

// ------------------------------------------------------------------ obstacle looks
check('obstacle look by position: the canyon, celestial and palace recolour; the arctic keeps the original', obstacleStyleAt(0) === 'canyon' && obstacleStyleAt(1499.9) === 'canyon' && obstacleStyleAt(1500) === null && obstacleStyleAt(2500) === 'celestial' && obstacleStyleAt(4000) === 'palace' && obstacleStyleAt(5000) === null);
check('no obstacle look with its own shapes is live (the animal and pillar looks are retired but kept)', ACTIVE_OBSTACLE_LOOKS.length === 0);

// ------------------------------------------------------------------ fairness: obstacles and orbs read against every backdrop colour
const lum = (h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const hexOk = (c) => /^#[0-9a-f]{6}$/i.test(c);
const NAMES = {
  canyon: ['sky top', 'sky mid', 'horizon', 'bright rock', 'rock', 'shadow', 'mist', 'dark rock'],
  celestial: ['void', 'mid sky', 'bright', 'teal nebula', 'violet nebula', 'pink glow', 'crystal', 'island'],
  palace: ['sky top', 'sky mid', 'horizon', 'white stone', 'pool', 'dark wood', 'crimson foliage'],
};
for (const zone of [K, C, P]) {
  const S = zone.scene;
  const flat = [];
  const collect = (v) => (typeof v === 'string' ? flat.push(v) : Array.isArray(v) ? v.forEach(collect) : v && typeof v === 'object' ? Object.values(v).forEach(collect) : null);
  collect(S);
  check(`${zone.id}: all palette colours are valid hex`, flat.every(hexOk), flat.filter((c) => !hexOk(c)).join());
  check(`${zone.id}: a backdrop colour per name`, S.backdrops.length === NAMES[zone.id].length);
  S.backdrops.forEach((bc, i) => {
    const bn = NAMES[zone.id][i];
    // Each obstacle shows a body and a cap, so what matters is the better of the two against every backdrop.
    for (const [name, o] of [['column', S.column], ['block', S.block]]) {
      const best = Math.max(contrast(o.color, bc), contrast(o.cap, bc));
      check(`${zone.id}: ${name} reads against ${bn}`, best >= 2, best.toFixed(2));
    }
    // a floating rock reads by whichever of its body and its glowing rim stands out more
    const seen = Math.max(contrast(S.rock.color, bc), contrast(S.rock.rim, bc));
    check(`${zone.id}: floating rock reads against ${bn}`, seen >= 2, seen.toFixed(2));
  });
}
// An orb is a core in a halo; it reads by whichever stands out more.
{
  const o = K.orbs;
  K.scene.backdrops.forEach((bc, i) => {
    const seen = Math.max(contrast(o.core, bc), contrast(o.halo, bc));
    check(`canyon: orbs read against ${NAMES.canyon[i]}`, seen >= 2.4, seen.toFixed(2));
  });
  check('canyon: edge-warning bars read against the bright rock and the sky', [K.scene.skyTop, K.scene.skyMid, '#e8785f'].every((bc) => contrast(K.warn, bc) >= 3), '');
}
// The Arctic keeps the themed obstacles, so test them in each theme against the colours of the arctic scenery.
for (const theme of THEME_LIST) {
  const T = theme.scene;
  const names = ['sky top', 'sky mid', 'horizon', 'snow', 'snow shadow', 'ice', 'slate rock'];
  R.scene.backdrops.forEach((bc, i) => {
    const pillar = Math.max(contrast(T.column.color, bc), contrast(T.column.cap, bc));
    const slab = Math.max(contrast(T.block.color, bc), contrast(T.block.cap, bc));
    check(`arctic/${theme.id}: pillar reads against ${names[i]}`, pillar >= 2, pillar.toFixed(2));
    check(`arctic/${theme.id}: slab reads against ${names[i]}`, slab >= 2, slab.toFixed(2));
    check(`arctic/${theme.id}: floating rock reads against ${names[i]}`, contrast(T.rock.color, bc) >= 1.25 || i >= 5, contrast(T.rock.color, bc).toFixed(2));
  });
  check(`arctic/${theme.id}: daytime orbs read against the sky and the snow`, [R.scene.skyTop, R.scene.snow, R.scene.snowShadow].every((bc) => contrast(T.orbHaloDay, bc) >= 1.7), '');
}

// ------------------------------------------------------------------ paintings
const PAINTINGS = {
  canyon: ['canyon-a.jpg', 'canyon-b.jpg', 'canyon-c.jpg'],
  arctic: ['frosty-glacier-valley.jpg', 'frosty-crystal-canyon.jpg', 'frosty-aurora-lake.jpg'],
  celestial: ['celestial-a.jpg', 'celestial-b.jpg', 'celestial-c.jpg'],
  palace: ['palace-a.jpg', 'palace-b.jpg', 'palace-c.jpg'],
};
const LIMIT_KB = { canyon: 180, arctic: 340, celestial: 180, palace: 220 };
for (const [zone, files] of Object.entries(PAINTINGS)) {
  for (const f of files) {
    const path = new URL(`../public/images/backdrop/${f}`, import.meta.url);
    check(`painting ${f} exists`, existsSync(path));
    if (existsSync(path)) check(`painting ${f} is under ${LIMIT_KB[zone]} kB`, statSync(path).size < LIMIT_KB[zone] * 1024, String(statSync(path).size));
  }
}
check('the retired scenery is gone from the live scene', !existsSync(new URL('../src/scenes/EmberValley/SundarbansBackdrop.jsx', import.meta.url)) && !existsSync(new URL('../src/scenes/EmberValley/AmazonBackdrop.jsx', import.meta.url)) && !existsSync(new URL('../src/scenes/EmberValley/VolcanoBackdrop.jsx', import.meta.url)));
const sceneSource = read('src/scenes/EmberValley/EmberValleyScene.jsx');
check('the scene mounts all four painted backdrops', ['CanyonBackdrop', 'ArcticBackdrop', 'CelestialBackdrop', 'PalaceBackdrop'].every((n) => new RegExp(n).test(sceneSource)));
const zoneParts = read('src/scenes/EmberValley/ZoneParts.jsx');
check('paintings load lazily, each at its own distance', /paintings\[i\]\.loadAt \?\? preloadAt/.test(zoneParts));
const canyon = read('src/scenes/EmberValley/CanyonBackdrop.jsx');
check('only the first canyon painting loads at start-up; the others load as the player approaches', /canyon-a\.jpg[^}]*loadAt: -1/.test(canyon) && /canyon-b\.jpg[^}]*loadAt: (\d+)/.test(canyon) && /canyon-c\.jpg[^}]*loadAt: (\d+)/.test(canyon));
check('one canyon painting per 500 m', /CUTS = \[500, 1000\]/.test(canyon));
const loadAtOf = (f) => Number(new RegExp(`${f}[^}]*loadAt: (-?\\d+)`).exec(canyon)?.[1]);
check('canyon paintings load before they are needed', loadAtOf('canyon-b') < 500 && loadAtOf('canyon-c') < 1000 && 500 - loadAtOf('canyon-b') <= 300 && 1000 - loadAtOf('canyon-c') <= 300);
const loadNear = { celestial: ['CelestialBackdrop.jsx', 1880, C], palace: ['PalaceBackdrop.jsx', 2880, P] };
for (const [id, [file, at, z]] of Object.entries(loadNear)) {
  const src = read(`src/scenes/EmberValley/${file}`);
  check(`${id} paintings load lazily, just before the zone`, new RegExp(`PRELOAD_AT = ${at}`).test(src) && at < z.start && z.start - at <= 200);
}
const arcticSrc = read('src/scenes/EmberValley/ArcticBackdrop.jsx');
check('Frosty Polar sub-scenes cut at 1665 and 1830 m, with about 35-40 m of overlap', /CUTS = \[1665, 1830\]/.test(arcticSrc) && Number(/DISSOLVE = (\d+)/.exec(arcticSrc)?.[1]) >= 30 && Number(/DISSOLVE = (\d+)/.exec(arcticSrc)?.[1]) <= 45);
{
  const loads = [...arcticSrc.matchAll(/frosty-[a-z-]+\.jpg[^}]*loadAt: (\d+)/g)].map((m) => Number(m[1]));
  check('Frosty paintings load about 150 m before they are needed', loads.length === 3 && loads[0] < 1500 && 1665 - loads[1] <= 200 && 1830 - loads[2] <= 200 && loads[1] < 1665 && loads[2] < 1830, loads.join());
}
check('every horizon-painted zone sets its waterline / valley on the horizon', /horizon: 0\.6/.test(canyon) && /horizon: 0\.6/.test(read('src/scenes/EmberValley/PalaceBackdrop.jsx')));
check('the picture never slides past its own edges (the view always stays inside it)', /vMin/.test(zoneParts));
check('the edge warning switches to a daytime look on pale scenery', /NormalBlending/.test(read('src/components/scene/EdgeWarning.jsx')));

// ------------------------------------------------------------------ the zones are scenery only
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const simFiles = ['game', 'physics', 'obstacles', 'scoring', 'bot'].flatMap((d) => walk(new URL(`../src/systems/${d}`, import.meta.url).pathname)).filter((f) => f.endsWith('.js'));
const offenders = simFiles.filter((f) => /world\/biomes|biomeWeight|zoneWeight|zoneStrength|biomeAt|dominantZone|obstacleStyleAt|theme\/themes/.test(readFileSync(f, 'utf8')));
check('the simulation, physics, obstacles, scoring and bot never read the zones or theme', offenders.length === 0, offenders.join());

console.log(failures ? `\n${failures} failed` : '\nbiome tests passed');
process.exit(failures ? 1 : 0);
