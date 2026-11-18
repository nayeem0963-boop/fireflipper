// Step 5 tests: texture lifecycle (residency + memory budget), distance-driven ambient animation, safety.
import { readFileSync } from 'node:fs';
import { AMBIENT, DRIFT, auroraStrength, driftItems, driftPoint, pulse } from '../src/systems/world/ambient.js';
import { UNLOAD_AFTER, cyclePlan, paintingSpan, residency } from '../src/systems/world/scrollDriver.js';
import { BIOMES, CROSSFADE, ZONE_IDS } from '../src/systems/world/biomes.js';
import { WORLD } from '../src/systems/physics/constants.js';

let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error('FAIL', m); } else console.log('ok  ', m); };
const read = (f) => readFileSync(new URL(`../src/scenes/EmberValley/${f}`, import.meta.url), 'utf8');

// ---- residency rules
ok(residency(100, 250, 560, false) === 'idle' && residency(251, 250, 560, false) === 'load', 'a painting loads once the run passes its loadAt');
ok(residency(650, 250, 560, true) === 'keep' && residency(661, 250, 560, true) === 'unload', `it is disposed ${UNLOAD_AFTER} m after the end of its stretch`);
ok(residency(700, 250, 560, false) === 'idle' && residency(661, 250, 560, false) === 'idle', 'a painting that is already behind the run is not loaded again');
ok(residency(0, 1350, 1735, true) === 'unload' && residency(1300, 1350, 1735, true) === 'keep', 'after a restart far before it, a painting is disposed; just before its loadAt it is kept (no thrash)');
ok(residency(5, -1, 530, true) === 'keep' && residency(3000, -1, 530, true) === 'keep', 'the very first painting (loadAt < 0) is never unloaded, so a retry starts without a reload');

// ---- memory budget: simulate the run over every distance using the real zone files
const info = { canyon: ['CanyonBackdrop.jsx', 1280, 720], arctic: ['ArcticBackdrop.jsx', 1408, 792], celestial: ['CelestialBackdrop.jsx', 1280, 698], palace: ['PalaceBackdrop.jsx', 1280, 720] };
const residents = [];
for (const id of ZONE_IDS) {
  if (id === 'sanctuary') continue; // looping zone: tested below
  const [file, w, h] = info[id];
  const src = read(file);
  const cuts = JSON.parse(/const CUTS = (\[[^\]]*\])/.exec(src)[1]);
  const dissolve = Number(/const DISSOLVE = (\d+)/.exec(src)?.[1] ?? 30);
  const preload = Number(/PRELOAD_AT = (\d+)/.exec(src)?.[1] ?? 0);
  const entries = [...src.matchAll(/\{ file: '([^']+)'[^}]*\}/g)].map((m) => ({ file: m[1], loadAt: Number(/loadAt: (-?\d+)/.exec(m[0])?.[1] ?? preload) }));
  entries.forEach((e, i) => {
    const [, end] = paintingSpan(BIOMES[id], cuts, dissolve, i, entries.length, CROSSFADE);
    residents.push({ ...e, end, mb: (w * h * 4 * 1.33) / 1e6 });
  });
}
let peak = 0, peakAt = 0, loaded = new Set();
for (let d = -10; d <= 5400; d += 5) {
  residents.forEach((r, i) => {
    const act = residency(d, r.loadAt, r.end, loaded.has(i));
    if (act === 'load') loaded.add(i);
    if (act === 'unload') loaded.delete(i);
  });
  const mb = [...loaded].reduce((s, i) => s + residents[i].mb, 0);
  if (mb > peak) { peak = mb; peakAt = d; }
}
ok(peak <= 25, `peak painting texture memory ${peak.toFixed(1)} MB at ${peakAt} m (target <= 25 MB)`);
const oldPeak = residents.reduce((s, r) => s + r.mb, 0);
console.log(`     for comparison, keeping every painting would use ${oldPeak.toFixed(1)} MB`);
// every painting is resident while it is visible
{
  let missing = 0, set = new Set();
  for (let d = -10; d <= 5400; d += 5) {
    residents.forEach((r, i) => { const act = residency(d, r.loadAt, r.end, set.has(i)); if (act === 'load') set.add(i); if (act === 'unload') set.delete(i); });
    residents.forEach((r, i) => { if (d > r.loadAt + 120 && d < r.end && !set.has(i)) missing++; });
  }
  ok(missing === 0, 'every painting is on the GPU for the whole stretch where it can be seen');
}
// loads happen ahead of the dissolve that shows them
for (const r of residents) ok(r.loadAt < 0 || r.end - r.loadAt >= 100, `${r.file} loads ahead of its stretch (loadAt ${r.loadAt}, ends ${r.end})`);

// ---- the looping zone: at most two sanctuary paintings on the GPU, ever
{
  const mb = (1408 * 792 * 4 * 1.33) / 1e6;
  let peakLoop = 0;
  for (let d = 4800; d < 80000; d += 5) peakLoop = Math.max(peakLoop, cyclePlan(d, 5000).wanted.length * mb);
  ok(peakLoop <= 12, `the endless Cloud Sanctuary never holds more than two paintings (${peakLoop.toFixed(1)} MB), however far the run goes`);
  // at the palace / sanctuary handover: the last palace painting and the first canyon painting (never unloaded) are also resident
  const small = (1280 * 720 * 4 * 1.33) / 1e6;
  ok(peakLoop + 2 * small <= 25, `at the palace / sanctuary handover the total (${(peakLoop + 2 * small).toFixed(1)} MB) stays inside the 25 MB target`);
  const zpSrc = read('ZoneParts.jsx');
  ok(/sl\.token !== token/.test(zpSrc) && /sl\.tex\?\.dispose\(\)/.test(zpSrc), 'a looping painting that finishes loading after it was replaced is freed');
}

// ---- stale loads are freed
const zp = read('ZoneParts.jsx');
ok(/own\.tokens\[i\] !== token/.test(zp) && /tex\.dispose\(\)/.test(zp), 'a load that finishes after its painting was unloaded frees the texture');
ok(/own\.textures\[i\]\?\.dispose\(\)/.test(zp) && /setMaps\(i, null\)/.test(zp), 'unloading clears the material maps and disposes the texture');

// ---- ambient animation
for (const id of ZONE_IDS) {
  const cfg = DRIFT[id];
  const items = driftItems(1);
  ok(AMBIENT.count <= 48 && items.length === AMBIENT.count, `${id}: ${items.length} particles (budget 48)`);
  let maxJump = 0, behind = true, inside = true;
  for (const it of items) {
    let prev = driftPoint(it, 0, cfg);
    for (let d = 0.5; d < 3000; d += 0.5) {
      const p = driftPoint(it, d, cfg);
      const dx = Math.min(Math.abs(p.x - prev.x), AMBIENT.span - Math.abs(p.x - prev.x));
      const dy = Math.min(Math.abs(p.y - prev.y), AMBIENT.height - Math.abs(p.y - prev.y));
      maxJump = Math.max(maxJump, dx, dy);
      if (p.z > -2.99) behind = false;
      if (p.y < WORLD.groundY - 1e-9 || p.y > WORLD.groundY + AMBIENT.height + 1e-9) inside = false;
      prev = p;
    }
  }
  ok(maxJump < 2, `${id}: particles move smoothly, no jumps across the loop seams (largest step ${maxJump.toFixed(2)} per 0.5 m)`);
  ok(behind, `${id}: particles stay behind the flight plane (z < -3), never over the bird, obstacles or orbs`);
  ok(inside, `${id}: particles stay between the floor and ${AMBIENT.height} units above it`);
}
const a = driftItems(5)[3];
ok(JSON.stringify(driftPoint(a, 123.4, DRIFT.arctic)) === JSON.stringify(driftPoint(a, 123.4, DRIFT.arctic)), 'particle position depends only on the distance (pause freezes it, any frame rate)');
ok(driftPoint(a, 0, DRIFT.celestial).y !== driftPoint(a, 400, DRIFT.celestial).y, 'celestial sparkles drift (rise) with distance');

// aurora: faint over Crystal Ice Canyon, full over Aurora Lake, zero before
ok(auroraStrength(1600) === 0 && auroraStrength(1750) > 0 && auroraStrength(1750) <= 0.3 && auroraStrength(1900) === 1, 'aurora strength: off, faint over Crystal Ice Canyon, full over Aurora Lake');
let smoothOk = true;
for (let d = 1500; d < 2000; d += 0.5) if (Math.abs(auroraStrength(d + 0.5) - auroraStrength(d)) > 0.05) smoothOk = false;
ok(smoothOk, 'aurora strength changes smoothly with distance');
ok(pulse(0, 90) === pulse(90, 90) || Math.abs(pulse(0, 90) - pulse(90, 90)) < 1e-9, 'pulse is periodic in distance');

// ---- no wall clock in any environment animation
const ambientSrc = read('AmbientEffects.jsx');
const moduleSrc = readFileSync(new URL('../src/systems/world/ambient.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
ok(!/elapsedTime|Date\.now|performance\.now|Math\.random|setInterval|setTimeout/.test(ambientSrc + moduleSrc), 'ambient animation uses no wall clock or randomness');
ok(!/state\.clock|elapsedTime/.test(zp), 'ParallaxLayer / PaintedHorizon use no wall clock (island bobbing follows the distance)');
for (const f of ['CanyonBackdrop.jsx', 'ArcticBackdrop.jsx', 'CelestialBackdrop.jsx', 'PalaceBackdrop.jsx']) ok(/DriftParticles/.test(read(f)), `${f} mounts ambient particles`);
ok(/AuroraShimmer/.test(read('ArcticBackdrop.jsx')), 'the Frosty Polar zone mounts the aurora shimmer');

if (failed) { console.error(`\n${failed} ambient test(s) failed`); process.exit(1); }
console.log('\nAll ambient tests passed');
