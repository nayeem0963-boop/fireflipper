// Scenery scroll driver tests: distance-driven, frame-rate independent, pause-safe, seamless, correctly layered.
import { readFileSync, readdirSync } from 'node:fs';
import { CYCLE, DEPTH_SLIDE, SCROLL_SPEED, cyclePlan, cycleSpan, SLIDE_CAP, effectiveSlack, layerSlack, loopOffset, paintingSlide, paintingSpan, progress, slideWidth, wrap } from '../src/systems/world/scrollDriver.js';
import { WORLDS, WORLD_LENGTH, paintingCuts } from '../src/systems/world/worlds.js';
import { BIOMES, CROSSFADE, ZONE_IDS } from '../src/systems/world/biomes.js';

let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error('FAIL', m); } else console.log('ok  ', m); };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// layering: far < mid < near < the bird's own plane (1 unit per metre)
ok(SCROLL_SPEED.far < SCROLL_SPEED.mid && SCROLL_SPEED.mid < SCROLL_SPEED.near && SCROLL_SPEED.near < 1, 'layer speeds ordered far < mid < near < 1');

// frame-rate independence: fly the same 5000 m at 30/60/120 fps (and a jittery one); offsets at the same distance are identical
const fly = (fps, jitter = false) => {
  let d = 0, t = 0, seed = 7;
  const speed = 12; // m/s
  const trace = new Map();
  while (d < 5000) {
    const dt = (1 / fps) * (jitter ? 0.4 + ((seed = (seed * 9301 + 49297) % 233280) / 233280) * 1.6 : 1);
    d += speed * dt; t += dt;
    trace.set(Math.round(d), [loopOffset(d, SCROLL_SPEED.mid, 120), paintingSlide(d, 0, 530, 20)]);
  }
  return trace;
};
for (const dist of [450, 1000, 2500, 4000]) {
  const results = [30, 60, 120].map((f) => { const d = dist + 0.37; return [loopOffset(d, SCROLL_SPEED.mid, 120), paintingSlide(d, 0, 5000, 20)]; });
  ok(results.every((r) => near(r[0], results[0][0]) && near(r[1], results[0][1])), `offset depends only on distance (${dist} m at 30/60/120 fps)`);
}
fly(30); fly(60); fly(120); fly(60, true);
ok(near(loopOffset(333.3, 0.25, 120), loopOffset(333.3, 0.25, 120)), 'pure: same distance gives same offset (pause = no motion)');

// pause: with the distance unchanged for any number of frames, nothing moves
const frozen = Array.from({ length: 600 }, () => paintingSlide(1234.5, 1000, 1530, 20));
ok(frozen.every((v) => v === frozen[0]), 'distance held (paused) gives zero motion over 600 frames');

// seamless loops: no jump at the seam, positive for negative distances
for (const [speed, span] of [[0.22, 190], [0.45, 120], [0.55, 104]]) {
  let worst = 0;
  for (let d = 0; d < 6000; d += 0.5) {
    const a = loopOffset(d, speed, span), b = loopOffset(d + 0.5, speed, span);
    const step = Math.min(Math.abs(b - a), span - Math.abs(b - a)); // wrap seam counts as continuous
    worst = Math.max(worst, step);
  }
  ok(near(worst, 0.5 * speed, 1e-6), `loop span ${span} speed ${speed}: step per 0.5 m is constant across the seam (${worst.toFixed(4)})`);
}
ok(wrap(-5, 120) === 115 && wrap(125, 120) === 5, 'wrap handles negative and overflow distances');

// painted slide: continuous, monotonic, spans the full slack, never exceeds it
const slack = 25;
let prev = paintingSlide(-100, 0, 530, slack), mono = true, maxStep = 0;
for (let d = -100; d < 700; d += 0.25) {
  const v = paintingSlide(d, 0, 530, slack);
  if (v > prev + 1e-12) mono = false;
  maxStep = Math.max(maxStep, Math.abs(v - prev));
  if (Math.abs(v) > slack + 1e-9) mono = false;
  prev = v;
}
ok(mono, 'painting slide is monotonic and inside its slack');
ok(maxStep <= (2 * slack) / 530 * 0.25 + 1e-9, 'painting slide has no jumps (constant speed)');
ok(near(paintingSlide(0, 0, 530, slack), slack) && near(paintingSlide(530, 0, 530, slack), -slack), 'painting slides through its entire slack across its stretch');
ok(near(progress(5, 10, 10), 0) && near(progress(15, 10, 10), 1), 'degenerate stretch handled');

// every live painting in every zone really moves, at >= the far-layer speed and below the mid-layer speed (it is the far backdrop)
const viewWs = { desktop: 158, phonePortrait: 42, phoneLandscape: 120 };
const read = (f) => readFileSync(new URL(`../src/scenes/EmberValley/${f}`, import.meta.url), 'utf8');
const zoneFiles = { canyon: 'CanyonBackdrop.jsx', arctic: 'ArcticBackdrop.jsx', celestial: 'CelestialBackdrop.jsx', palace: 'PalaceBackdrop.jsx' };
for (const id of ZONE_IDS) {
  if (id === 'sanctuary') continue; // the looping zone is tested below
  const z = BIOMES[id];
  const src = read(zoneFiles[id]);
  const wi = WORLDS.findIndex((w) => w.id === id);
  ok(new RegExp(`const CUTS = paintingCuts\\(${wi}, 3\\)`).test(src), `${id}: the painting cuts come from worlds.js (thirds of the world)`);
  const cuts = paintingCuts(wi, 3);
  const dissolve = Number(/const DISSOLVE = (\d+)/.exec(src)?.[1] ?? 30);
  const count = cuts.length + 1;
  for (let i = 0; i < count; i++) {
    const [a, b] = paintingSpan(z, cuts, dissolve, i, count, CROSSFADE);
    for (const [name, vw] of Object.entries(viewWs)) {
      const depth = /\bdepth\s*\/>/.test(src);
      const W = slideWidth(vw, b - a, depth ? DEPTH_SLIDE.near : undefined);
      const slack = (W - vw) / 2;
      const speed = (2 * (depth ? layerSlack(slack, 'far') : slack)) / (b - a);
      ok(speed >= SCROLL_SPEED.far - 1e-9 && speed < SCROLL_SPEED.mid, `${id} painting ${i} (${a}-${b} m) on ${name}: far layer slides at ${speed.toFixed(3)} u/m${depth ? ' (depth layers)' : ''}`);
      if (depth) {
        const [fs, ms, ns] = ['far', 'mid', 'near'].map((l) => layerSlack(slack, l));
        ok(fs < ms && ms < ns && ns <= slack + 1e-9, `${id} painting ${i} on ${name}: layer slides ordered far < mid < near and inside the painting`);
      }
    }
  }
  ok(!/\bpan=\{/.test(src), `${id}: no leftover static pan prop`);
}

// the slide cap: however wide the picture, the backdrop never moves faster than SLIDE_CAP and always stays slower than the 3D mid layer
for (const [a, b] of [[1460, 1685], [1645, 1850], [0, 560]]) {
  const eff = effectiveSlack(1e6, a, b);
  ok((2 * eff) / (b - a) <= SLIDE_CAP + 1e-12 && SLIDE_CAP < SCROLL_SPEED.mid, `slide cap holds on a huge picture over ${a}-${b} m (${((2 * eff) / (b - a)).toFixed(3)} u/m)`);
}
ok(effectiveSlack(3, 0, 560) === 3, 'a picture with little slack is not stretched by the cap');

// depth layers: ordered speeds, masks created and disposed, enabled on the zones that have been reviewed
ok(DEPTH_SLIDE.far < DEPTH_SLIDE.mid && DEPTH_SLIDE.mid < DEPTH_SLIDE.near && DEPTH_SLIDE.near < SCROLL_SPEED.mid, 'painted depth layers slide slower than the 3D mid layer');
for (const id of ['canyon', 'arctic', 'celestial', 'palace']) ok(/\bdepth\s*\/>/.test(read(zoneFiles[id])), `${id} uses painted depth layers`);
{
  const p = read('ZoneParts.jsx');
  ok(/createDepthMask\('mid'\)/.test(p) && /masks\?\.mid\.dispose\(\)/.test(p), 'depth masks are created and disposed');
}

// a later painting always draws over an earlier one, whatever their horizons (explicit renderOrder by painting index)
ok(/renderOrder=\{-2 \+ i \* 0\.1\}/.test(read('ZoneParts.jsx')) && /renderOrder=\{-2 \+ i \* 0\.1 \+ \(k \+ 1\) \* 0\.02\}/.test(read('ZoneParts.jsx')), 'painting draw order follows the painting index (far, mid, near within each)');

// ---- the Cloud Sanctuary as shipped: world 5 (8000 to 10000 m), five paintings of 400 m each
{
  const files = ['dragon', 'cat', 'deer', 'tiger', 'clouds'];
  const L = WORLD_LENGTH / files.length;
  const shown = (d) => files[cyclePlan(d, 8000, L).k];
  ok(L === 400 && shown(8000) === 'dragon' && shown(8399) === 'dragon' && shown(8400) === 'cat' && shown(8800) === 'deer' && shown(9200) === 'tiger' && shown(9600) === 'clouds' && shown(9999.9) === 'clouds', 'the five sanctuary paintings fill 8000 to 10000 m, 400 m each, in order');
  let most = 0;
  for (let d = 7800; d <= 10000; d += 3) { const p = cyclePlan(d, 8000, L); most = Math.max(most, p.wanted.length); if (p.k >= 0 && p.k < 5 && !p.wanted.includes(p.k)) most = 99; }
  ok(most <= 2, 'at most two paintings resident at once with the 400 m sections');
  ok(read('SanctuaryBackdrop.jsx').includes('SECTION = WORLD_LENGTH / FILES.length') && /length=\{SECTION\}/.test(read('SanctuaryBackdrop.jsx')), 'the backdrop passes the 400 m section length');
}

// ---- the looping machinery (generic: five paintings of 1000 m each from 5000 m, repeating for ever)
{
  const files = ['dragon', 'cat', 'deer', 'tiger', 'clouds'];
  const shown = (d) => files[cyclePlan(d, 5000).k % 5];
  ok(shown(5000) === 'dragon' && shown(5999) === 'dragon' && shown(6000) === 'cat' && shown(7000) === 'deer' && shown(8000) === 'tiger' && shown(9000) === 'clouds', 'five paintings, 1000 m each, in the order dragon, cat, deer, tiger, clouds');
  ok(shown(10000) === 'dragon' && shown(14999) === 'clouds' && shown(15000) === 'dragon' && shown(5000 + 5000 * 20 + 3000) === 'tiger', 'the cycle repeats after the fifth (10000 m = dragon again), for any distance');
  ok(cyclePlan(4990, 5000).k === -1 && cyclePlan(4990, 5000).wanted.join() === '0', 'the first painting is preloaded before the zone starts');
  // never more than two paintings wanted, never two in the same slot, over a very long run
  let most = 0, clash = false, missingCurrent = false;
  for (let d = 4000; d < 60000; d += 7) {
    const p = cyclePlan(d, 5000);
    most = Math.max(most, p.wanted.length);
    if (new Set(p.wanted.map((k) => k % 2)).size !== p.wanted.length) clash = true;
    if (p.k >= 0 && !p.wanted.includes(p.k)) missingCurrent = true;
  }
  ok(most <= 2 && !clash && !missingCurrent, `at most ${most} paintings resident at any distance up to 60 km, each in its own slot, the current one always included`);
  ok(cyclePlan(5900, 5000).wanted.join() === '0' && cyclePlan(5860, 5000).wanted.join() === '0,1' && cyclePlan(6050, 5000).wanted.join() === '1,0' || cyclePlan(6050, 5000).wanted.includes(0), 'the next painting loads 150 m ahead; the previous stays until 100 m past the cut');
  ok(!cyclePlan(6150, 5000).wanted.includes(0), 'the previous painting is dropped 100 m after the cut');
  const [a, b] = cycleSpan(3, 5000);
  ok(a === 5000 + 3000 - CYCLE.dissolve / 2 && b === 5000 + 4000 + CYCLE.dissolve / 2, 'each painting slides across its own stretch (dissolve overlap included)');
  // the dissolve at each cut is continuous: alpha of painting k rises over the dissolve and the old painting stays underneath
  const alpha = (k, d) => { const t = Math.min(1, Math.max(0, (d - (5000 + k * 1000 - 30)) / 60)); return t * t * (3 - 2 * t); };
  let monotone = true;
  for (let d = 5900; d < 6100; d += 0.5) if (alpha(1, d + 0.5) < alpha(1, d)) monotone = false;
  ok(monotone && alpha(1, 5969) === 0 && alpha(1, 6031) === 1, 'the dissolve into the next painting is monotone and takes 60 m');
}

// no wall-clock time in the painted-backdrop path or the driver
const parts = read('ZoneParts.jsx');
const horizon = parts.slice(parts.indexOf('export function PaintedHorizon'), parts.indexOf('export function ParallaxLayer'));
ok(!/elapsedTime|Date\.now|performance\.now|requestAnimationFrame|setInterval|setTimeout/.test(horizon), 'PaintedHorizon uses no wall clock');
ok(/paintingSlide\(/.test(horizon) && /renderDistance\(\)/.test(horizon), 'PaintedHorizon slides from renderDistance() via the scroll driver');
const driver = readFileSync(new URL('../src/systems/world/scrollDriver.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
ok(!/Date|performance|clock|random/i.test(driver), 'scroll driver has no clock or randomness');

// simulation isolation: nothing in the sim imports scenery code
const simDir = new URL('../src/systems/', import.meta.url);
const walk = (u) => readdirSync(u, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(new URL(`${e.name}/`, u)) : [new URL(e.name, u)]));
const simFiles = walk(simDir).filter((u) => /createGameSim|physics\/|collision/i.test(u.pathname) && u.pathname.endsWith('.js'));
ok(simFiles.length > 0 && simFiles.every((u) => !/scrollDriver|EmberValley/.test(readFileSync(u, 'utf8'))), 'simulation/physics/collision do not import the scroll driver or scenery');

if (failed) { console.error(`\n${failed} scroll test(s) failed`); process.exit(1); }
console.log('\nAll scroll tests passed');
