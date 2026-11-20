/**
 * Scenery-zone tests (five worlds of 2000 m: Red Rock Canyon 0-2000 m, Frosty Polar 2000-4000 m, Celestial Realm 4000-6000 m, Rose Sky Palace 6000-8000 m, Cloud Sanctuary 8000-10000 m).
 * Run with: npm run test:biome
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACTIVE_OBSTACLE_LOOKS, BIOMES, CROSSFADE, FADE, ZONE_IDS, biomeAt, biomeWeights, dominantZone, obstacleStyleAt, zoneStrength, zoneWeight,
} from '../src/systems/world/biomes.js';
import { PRELOAD_LEAD, paintingCuts } from '../src/systems/world/worlds.js';
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
const SZ = BIOMES.sanctuary;

// ------------------------------------------------------------------ ranges
check('Red Rock Canyon covers 0 to 2000 m', K.start === 0 && K.end === 2000);
check('Frosty Polar covers 2000 to 4000 m', R.start === 2000 && R.end === 4000);
check('Celestial Realm covers 4000 to 6000 m', C.start === 4000 && C.end === 6000);
check('Rose Sky Palace covers 6000 to 8000 m', P.start === 6000 && P.end === 8000);
check('five live zones, in order; the retired scenes are not among them', ZONE_IDS.join() === 'canyon,arctic,celestial,palace,sanctuary' && BIOMES.sundarbans.retired && BIOMES.amazon.retired);
check('zone lookup by border', biomeAt(0)?.id === 'canyon' && biomeAt(1999.9)?.id === 'canyon' && biomeAt(2000)?.id === 'arctic' && biomeAt(3999.9)?.id === 'arctic' && biomeAt(4000)?.id === 'celestial' && biomeAt(5999.9)?.id === 'celestial' && biomeAt(6000)?.id === 'palace' && biomeAt(7999.9)?.id === 'palace' && biomeAt(8000)?.id === 'sanctuary' && biomeAt(9000)?.id === 'sanctuary' && biomeAt(1e7)?.id === 'sanctuary');
check('game-over wording per zone', /canyon/i.test(K.lavaCopy) && /ice/i.test(R.lavaCopy) && /cloud/i.test(C.lavaCopy) && /pool/i.test(P.lavaCopy));

// Each zone is full strength well inside it, and absent well outside it.
check('Canyon is full strength from the start to 1960 m, gone from 2040 m', [0, 1, 250, 750, 1250, 1960].every((d) => zoneWeight(K, d) === 1) && zoneWeight(K, 2040) === 0 && zoneWeight(K, 6000) === 0);
check('Arctic is off before 1960 m, full from 2040 to 3960 m, gone from 4040 m', zoneWeight(R, 0) === 0 && zoneWeight(R, 1960) === 0 && [2040, 3000, 3960].every((d) => zoneWeight(R, d) === 1) && zoneWeight(R, 4040) === 0);
check('Celestial is off before 3960 m, full from 4040 to 5960 m, gone from 6040 m', zoneWeight(C, 0) === 0 && zoneWeight(C, 3960) === 0 && [4040, 5000, 5960].every((d) => zoneWeight(C, d) === 1) && zoneWeight(C, 6040) === 0);
check('Palace is off before 5960 m, full from 6040 to 7960 m, gone by 8040 m', zoneWeight(P, 0) === 0 && zoneWeight(P, 5960) === 0 && [6040, 7000, 7960].every((d) => zoneWeight(P, d) === 1) && zoneWeight(P, 8040) === 0 && zoneWeight(P, 9500) === 0);
check('Cloud Sanctuary starts at 8000 m, has no scenery edge, and is full from 8040 m (the run itself ends at 10000 m)', SZ.start === 8000 && SZ.end === Infinity && zoneWeight(SZ, 7960) === 0 && [8040, 9000, 10000, 123456, 1e9].every((d) => zoneWeight(SZ, d) === 1) && Math.abs(zoneWeight(SZ, 8000) - 0.5) < 1e-9);
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
for (let d = 0.5; d <= 10200; d += 0.5) {
  const w = biomeWeights(d);
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-9) sumsToOne = false;
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
check('weights add up to 1 at every distance, through 10200 m (no gap between zones)', sumsToOne);
check('weights add up to 1 far beyond (10 km, 100 km)', [10000, 55555, 100000].every((d) => Math.abs(Object.values(biomeWeights(d)).reduce((a, b) => a + b, 0) - 1) < 1e-9));
check('combined strength stays within 0..1', strengthOk);
check('every handover is smooth (no pops)', smoothSteps);
check('each zone rises once and falls once (never flickers back)', Object.values(turns).every((t) => t <= 1) && Object.values(peaks).every((p) => Math.abs(p - 1) < 1e-9), JSON.stringify({ turns, peaks }));
check('cross-fade is centred on the 2000, 4000, 6000 and 8000 m borders', [[K, R, 2000], [R, C, 4000], [C, P, 6000], [P, SZ, 8000]].every(([a, b, at]) => Math.abs(zoneWeight(a, at) - 0.5) < 1e-9 && Math.abs(zoneWeight(b, at) - 0.5) < 1e-9));
check('the run starts inside the canyon with no fade-in', zoneWeight(K, 0) === 1);
check('the original scenery never returns: the zones cover every distance', [0, 2000, 8000, 8020, 9999, 1e6].every((d) => Math.abs(zoneStrength(d) - 1) < 1e-9));
check('dominant zone', dominantZone(10)?.id === 'canyon' && dominantZone(2500)?.id === 'arctic' && dominantZone(4500)?.id === 'celestial' && dominantZone(7000)?.id === 'palace' && dominantZone(9000)?.id === 'sanctuary' && dominantZone(50000)?.id === 'sanctuary');

// ------------------------------------------------------------------ obstacle looks
check('obstacle look by position: the canyon, celestial and palace recolour; the arctic and the sanctuary keep the original', obstacleStyleAt(0) === 'canyon' && obstacleStyleAt(1999.9) === 'canyon' && obstacleStyleAt(2000) === null && obstacleStyleAt(4500) === 'celestial' && obstacleStyleAt(7000) === 'palace' && obstacleStyleAt(8000) === null && obstacleStyleAt(9500) === null);
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

// The Cloud Sanctuary also keeps the themed (original) obstacles: test them against the sanctuary's sky and cloud colours.
for (const theme of THEME_LIST) {
  const T = theme.scene;
  SZ.scene.backdrops.forEach((bc, i) => {
    const pillar = Math.max(contrast(T.column.color, bc), contrast(T.column.cap, bc));
    const slab = Math.max(contrast(T.block.color, bc), contrast(T.block.cap, bc));
    check(`sanctuary/${theme.id}: pillar reads against backdrop colour ${i + 1}`, pillar >= 2, pillar.toFixed(2));
    check(`sanctuary/${theme.id}: slab reads against backdrop colour ${i + 1}`, slab >= 2, slab.toFixed(2));
  });
  check(`sanctuary/${theme.id}: daytime orbs read against the sky and the clouds`, [SZ.scene.skyMid, SZ.scene.cloud, SZ.scene.cloudShadow].every((bc) => contrast(T.orbHaloDay, bc) >= 1.7), '');
}

// ------------------------------------------------------------------ paintings
const PAINTINGS = {
  canyon: ['canyon-a.jpg', 'canyon-b.jpg', 'canyon-c.jpg'],
  arctic: ['frosty-glacier-valley.jpg', 'frosty-crystal-canyon.jpg', 'frosty-aurora-lake.jpg'],
  celestial: ['celestial-a.jpg', 'celestial-b.jpg', 'celestial-c.jpg'],
  palace: ['palace-a.jpg', 'palace-b.jpg', 'palace-c.jpg'],
  sanctuary: ['sanctuary-dragon.jpg', 'sanctuary-cat.jpg', 'sanctuary-deer.jpg', 'sanctuary-tiger.jpg', 'sanctuary-clouds.jpg'],
};
const LIMIT_KB = { canyon: 180, arctic: 340, celestial: 180, palace: 220, sanctuary: 300 };
for (const [zone, files] of Object.entries(PAINTINGS)) {
  for (const f of files) {
    const path = new URL(`../public/images/backdrop/${f}`, import.meta.url);
    check(`painting ${f} exists`, existsSync(path));
    if (existsSync(path)) check(`painting ${f} is under ${LIMIT_KB[zone]} kB`, statSync(path).size < LIMIT_KB[zone] * 1024, String(statSync(path).size));
  }
}
check('the retired scenery is gone from the live scene', !existsSync(new URL('../src/scenes/EmberValley/SundarbansBackdrop.jsx', import.meta.url)) && !existsSync(new URL('../src/scenes/EmberValley/AmazonBackdrop.jsx', import.meta.url)) && !existsSync(new URL('../src/scenes/EmberValley/VolcanoBackdrop.jsx', import.meta.url)));
const sceneSource = read('src/scenes/EmberValley/EmberValleyScene.jsx');
check('the scene mounts all five painted backdrops', ['CanyonBackdrop', 'ArcticBackdrop', 'CelestialBackdrop', 'PalaceBackdrop', 'SanctuaryBackdrop'].every((n) => new RegExp(n).test(sceneSource)));
const zoneParts = read('src/scenes/EmberValley/ZoneParts.jsx');
check('paintings load lazily, each at its own distance', /paintings\[i\]\.loadAt \?\? preloadAt/.test(zoneParts));
const canyon = read('src/scenes/EmberValley/CanyonBackdrop.jsx');
check('only the first canyon painting loads at start-up; the others load as the player approaches', /canyon-a\.jpg[^}]*loadAt: -1/.test(canyon) && /canyon-b\.jpg[^}]*loadAt: CUTS\[0\] - PRELOAD_LEAD/.test(canyon) && /canyon-c\.jpg[^}]*loadAt: CUTS\[1\] - PRELOAD_LEAD/.test(canyon));
check('the canyon paintings share the world equally (cuts from worlds.js: a third of 2000 m each)', /CUTS = paintingCuts\(0, 3\)/.test(canyon) && paintingCuts(0, 3).map(Math.round).join() === '667,1333');
check('every painting loads before it is needed, within PRELOAD_LEAD', PRELOAD_LEAD >= 100 && PRELOAD_LEAD <= 300);
const loadNear = { celestial: ['CelestialBackdrop.jsx', C, 2], palace: ['PalaceBackdrop.jsx', P, 3] };
for (const [id, [file, z, wi]] of Object.entries(loadNear)) {
  const src = read(`src/scenes/EmberValley/${file}`);
  check(`${id} paintings load lazily, just before the zone, and cut at thirds of the world`, /PRELOAD_AT = Z\.start - PRELOAD_LEAD/.test(src) && new RegExp(`CUTS = paintingCuts\\(${wi}, 3\\)`).test(src) && z.start - PRELOAD_LEAD >= 0);
}
const arcticSrc = read('src/scenes/EmberValley/ArcticBackdrop.jsx');
check('Frosty Polar sub-scenes cut at thirds of the world, with about 35-40 m of overlap', /CUTS = paintingCuts\(1, 3\)/.test(arcticSrc) && Number(/DISSOLVE = (\d+)/.exec(arcticSrc)?.[1]) >= 30 && Number(/DISSOLVE = (\d+)/.exec(arcticSrc)?.[1]) <= 45);
check('Frosty paintings load PRELOAD_LEAD before they are needed', /loadAt: Z\.start - PRELOAD_LEAD/.test(arcticSrc) && /loadAt: CUTS\[0\] - PRELOAD_LEAD/.test(arcticSrc) && /loadAt: CUTS\[1\] - PRELOAD_LEAD/.test(arcticSrc));
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
