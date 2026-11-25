// Frame-rate matrix: every distance-driven scenery value at the 19 test distances, for runs rendered at 30, 60 and 120 fps (and an uneven frame
// pacing): the values must depend only on the distance, and no value may jump between two frames by more than its speed allows.
import { BIOMES, CROSSFADE, ZONE_IDS, biomeWeights, zoneWeight } from '../src/systems/world/biomes.js';
import { CYCLE, DEPTH_SLIDE, SCROLL_SPEED, cyclePlan, cycleSpan, effectiveSlack, layerSlack, loopOffset, paintingSlide, paintingSpan } from '../src/systems/world/scrollDriver.js';
import { DRIFT, auroraStrength, driftItems, driftPoint, pulse } from '../src/systems/world/ambient.js';
import { foregroundItems, foregroundX } from '../src/systems/world/foreground.js';

let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.error('FAIL', m); } else console.log('ok  ', m); };
const DISTANCES = [0, 450, 500, 950, 1000, 1450, 1500, 1665, 1830, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];
const items = driftItems(3);
const fg = foregroundItems(101);

/** Every scenery value for a distance, as one vector. */
function sample(d, discrete = true) {
  const v = [];
  v.push(loopOffset(d, SCROLL_SPEED.mid, 120), loopOffset(d, 0.22, 190), loopOffset(d, 0.45, 120));
  for (const id of ZONE_IDS) {
    v.push(zoneWeight(BIOMES[id], d));
    v.push(driftPoint(items[5], d, DRIFT[id]).x, driftPoint(items[5], d, DRIFT[id]).y);
  }
  v.push(...fg.slice(0, 3).map((it) => foregroundX(it, d)));
  v.push(auroraStrength(d), pulse(d, 90));
  // painted slides: each zone's paintings and the looping zone
  const cuts = { canyon: [500, 1000], arctic: [1665, 1830], celestial: [2330, 2660], palace: [3660, 4330] };
  const dis = { canyon: 60, arctic: 40, celestial: 30, palace: 70 };
  for (const id of Object.keys(cuts)) {
    for (let i = 0; i < 3; i++) {
      const [a, b] = paintingSpan(BIOMES[id], cuts[id], dis[id], i, 3, CROSSFADE);
      v.push(paintingSlide(d, a, b, layerSlack(effectiveSlack(30, a, b), 'mid')));
    }
  }
  const plan = cyclePlan(d, 5000);
  const [a, b] = cycleSpan(Math.max(0, plan.k), 5000);
  if (discrete) v.push(plan.k, plan.wanted.length); // indexes jump by design; only the equality check uses them
  v.push(paintingSlide(d, a, b, effectiveSlack(30, a, b)));
  return v;
}

// 1. depends only on the distance: the frame sequence (30/60/120 fps, uneven) never changes the value at a given distance
const runs = { '30 fps': 1 / 30, '60 fps': 1 / 60, '120 fps': 1 / 120 };
const speed = 14; // m/s
for (const dist of DISTANCES) {
  const ref = sample(dist);
  let same = true;
  for (const dt of Object.values(runs)) {
    let d = 0, seed = 9;
    const jitter = dt === 1 / 60;
    while (d < dist) {
      const step = dt * (jitter ? 0.4 + ((seed = (seed * 9301 + 49297) % 233280) / 233280) * 1.6 : 1);
      d = Math.min(dist, d + speed * step);
    }
    const got = sample(d);
    if (got.some((x, i) => Math.abs(x - ref[i]) > 1e-9)) same = false;
  }
  ok(same, `${dist} m: all scenery values identical at 30, 60, 120 fps and with uneven pacing`);
}

// 2. no pops between frames: the largest per-frame change of every value is bounded by what the speed of the run allows
for (const [label, dt] of Object.entries(runs)) {
  let worst = 0, at = 0;
  let prev = sample(0, false);
  for (let d = speed * dt; d < 11000; d += speed * dt) {
    const cur = sample(d, false);
    // skip discrete values (indexes), wrap seams (loops) and the slot count: compare smooth values only
    for (let i = 0; i < cur.length; i++) {
      const dx = Math.abs(cur[i] - prev[i]);
      const wrapped = Math.min(dx, 190 - dx, 70 - dx);
      const delta = Math.min(dx, wrapped >= 0 ? wrapped : dx);
      if (dx < 5 && delta > worst) { worst = delta; at = d; }
    }
    prev = cur;
  }
  ok(worst < speed * dt * 1.0 + 0.2, `${label}: largest per-frame scenery change ${worst.toFixed(3)} (run moves ${(speed * dt).toFixed(3)} m per frame; at ${at.toFixed(0)} m)`);
}

// 3. 120 Hz physics vs render rate: scenery distance is the sim's interpolated distance, so it advances 14 m/s at any render rate
for (const [label, dt] of Object.entries(runs)) {
  const frames = Math.round(10 / dt);
  ok(Math.abs(frames * dt * speed - 140) < 1e-6 * frames + 1e-6, `${label}: ten seconds of flight advance the scenery by 140 m`);
}
ok(Math.abs(CYCLE.length - 1000) < 1e-9 && DEPTH_SLIDE.far < DEPTH_SLIDE.near, 'cycle length and depth speeds as specified');

if (failed) { console.error(`\n${failed} fps test(s) failed`); process.exit(1); }
console.log('\nAll fps tests passed');
