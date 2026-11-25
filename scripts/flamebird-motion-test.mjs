/**
 * FlameBird motion tests. Run with: npm run test:flamebird
 * The wing pose is measured with the clips' own curves (both are 0.8 s loops: FB_Fly raises the wing 20 + 20 sin,
 * FB_WingFlap 12.5 + 27.5 sin, degrees) and compared with the old approach, which set the clip time directly.
 */
import { createMotion, stepMotion, STROKE_TIME, TOP, BOTTOM, CLIP_LEN } from '../src/components/scene/flameBirdMotion.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) failures++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name} ${detail}`);
};

const DT = 1 / 60;
// The fastest the clips themselves move the wing at 60 fps: the quick lift to the top of a stroke (27.5 deg x 2 pi / 0.8 s x 2.2) is about 7.9 deg a frame.
// Anything above JUMP is a discontinuity, not motion; the old approach jumped up to ~38 deg.
const JUMP = 9;
const fly = (t) => 20 + 20 * Math.sin((2 * Math.PI * t) / CLIP_LEN);
const flap = (t) => 12.5 + 27.5 * Math.sin((2 * Math.PI * t) / CLIP_LEN);
const wing = (o) => o.flyWeight * fly(o.flyTime) + o.strokes.reduce((a, s) => a + s.weight * flap(s.time), 0);

/** The previous FlameBird: clip time jumped to the downstroke on every flap. */
function oldWing(state, bird, dt) {
  if (bird.dead) state.t = 0.4;
  else if (bird.sinceFlap < STROKE_TIME) state.t = TOP + (BOTTOM - TOP) * (bird.sinceFlap / STROKE_TIME);
  else state.t = (state.t + dt * (7 / ((2 * Math.PI) / CLIP_LEN))) % CLIP_LEN;
  return fly(state.t);
}

/** Fly for `seconds`, tapping at the given times; returns the largest frame-to-frame wing change (degrees) and samples. */
function run(taps, seconds = 4, deadAt = Infinity) {
  const m = createMotion();
  const old = { t: TOP };
  const bird = { vy: 0, pitch: 0, sinceFlap: 99, dead: false };
  let prevNew = null;
  let prevOld = null;
  let maxNew = 0;
  let maxOld = 0;
  let weightErr = 0;
  let finite = true;
  const outs = [];
  for (let f = 0; f * DT < seconds; f++) {
    const t = f * DT;
    if (taps.some((x) => Math.abs(x - t) < DT / 2)) {
      bird.sinceFlap = 0;
      bird.vy = 6;
    } else {
      bird.sinceFlap += DT;
      bird.vy -= 18 * DT;
    }
    bird.pitch = Math.max(-0.6, Math.min(0.5, bird.vy * 0.05));
    if (t >= deadAt) bird.dead = true;
    const o = stepMotion(m, bird, DT, 7, t);
    outs.push(o);
    const w = wing(o);
    const wo = oldWing(old, bird, DT);
    if (prevNew !== null) maxNew = Math.max(maxNew, Math.abs(w - prevNew));
    if (prevOld !== null) maxOld = Math.max(maxOld, Math.abs(wo - prevOld));
    prevNew = w;
    prevOld = wo;
    weightErr = Math.max(weightErr, Math.abs(o.flyWeight + o.strokes.reduce((a, s) => a + s.weight, 0) - 1));
    finite = finite && [w, ...Object.values(o.bones)].every(Number.isFinite);
  }
  return { maxNew, maxOld, weightErr, finite, outs, m };
}

// a steady beat with no taps
const calm = run([]);
check('cruising without taps changes the wing smoothly (< 2.5 deg per frame)', calm.maxNew < 2.5, `${calm.maxNew.toFixed(2)} deg`);

// regular taps, the way the bot plays
const regular = run([0.5, 1.1, 1.7, 2.3, 2.9, 3.5]);
check(`regular taps: no jumps (< ${JUMP} deg per frame at 60 fps)`, regular.maxNew < JUMP, `new ${regular.maxNew.toFixed(2)} deg, old ${regular.maxOld.toFixed(2)} deg`);
check('regular taps: smoother than setting the clip time directly', regular.maxNew < regular.maxOld * 0.5);

// frantic tapping, every 0.12 s (faster than one stroke)
const frantic = run(Array.from({ length: 25 }, (_, i) => 0.3 + i * 0.12));
check(`rapid taps: no jumps (< ${JUMP} deg per frame)`, frantic.maxNew < JUMP, `new ${frantic.maxNew.toFixed(2)} deg, old ${frantic.maxOld.toFixed(2)} deg`);

// the stroke is still visible: within a stroke's time of a tap, the wing comes down hard
{
  const r = run([1.0], 2);
  const at = (t) => wing(r.outs[Math.round(t / DT)]);
  const top = Math.max(...[0.98, 1.0, 1.02, 1.04, 1.06].map(at));
  const low = Math.min(...[1.2, 1.24, 1.28, 1.32].map(at));
  check('a tap still reads as a powered downstroke (the wing drops at least 30 deg within the stroke)', top - low >= 30, `${top.toFixed(1)} -> ${low.toFixed(1)} deg`);
}

for (const [name, r] of [['calm', calm], ['regular', regular], ['rapid', frantic]]) {
  check(`${name}: clip weights always sum to 1`, r.weightErr < 1e-6, r.weightErr.toExponential(1));
  check(`${name}: every value is finite`, r.finite);
}

// after a crash the beat eases to a stop instead of snapping
{
  const r = run([0.5], 3, 1.2);
  const after = r.outs.slice(Math.round(1.2 / DT));
  const moved = after.slice(0, 3).some((o, i, a) => i > 0 && o.flyTime !== a[i - 1].flyTime);
  const stillLater = Math.abs(after[after.length - 1].flyTime - after[after.length - 2].flyTime) < 1e-4;
  check('crash: the wings slow to a stop (not a snap)', moved && stillLater && r.maxNew < JUMP, `max ${r.maxNew.toFixed(2)} deg`);
}

// follow-through springs settle once the taps stop
{
  const r = run([0.5, 0.62, 0.74], 5);
  const last = r.outs[r.outs.length - 1].bones;
  const peak = Math.max(...r.outs.map((o) => Math.abs(o.bones.crest)));
  check('crest and tail follow through and stay within limits', peak > 0.08 && peak <= 0.5, `crest peak ${peak.toFixed(3)} rad`);
  check('springs settle (crest and tail velocity near zero 4 s later)', Math.abs(r.m.crest.v) < 0.05 && Math.abs(r.m.tail.v) < 0.05, `crest ${last.crest.toFixed(3)}, tail ${last.tail.toFixed(3)}`);
}

// menus (no flight): a steady beat
{
  const m = createMotion();
  let prev = null;
  let max = 0;
  for (let f = 0; f < 240; f++) {
    const o = stepMotion(m, null, DT, 5.5, f * DT);
    const w = wing(o);
    if (prev !== null) max = Math.max(max, Math.abs(w - prev));
    prev = w;
  }
  check('menu preview (no flight state): steady, smooth beat', max < 2.5, `${max.toFixed(2)} deg`);
}

// face: blinks and the beak
{
  let seed = 7;
  const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const m = createMotion(rng);
  let blinks = 0;
  let wasClosed = false;
  let chirps = 0;
  let wasOpen = false;
  let inRange = true;
  for (let f = 0; f < 60 * 20; f++) {
    const o = stepMotion(m, null, DT, 5.5, f * DT);
    inRange = inRange && o.eyes >= 0 && o.eyes <= 1 && o.beak >= 0 && o.beak <= 1;
    if (o.eyes > 0.8 && !wasClosed) blinks++;
    wasClosed = o.eyes > 0.8;
    if (o.beak > 0.5 && !wasOpen) chirps++;
    wasOpen = o.beak > 0.5;
  }
  check('menus: blinks every few seconds (3 to 12 in 20 s)', blinks >= 3 && blinks <= 12, `${blinks} blinks`);
  check('menus: the beak chirps now and then (3 to 16 openings in 20 s)', chirps >= 3 && chirps <= 16, `${chirps} openings`);
  check('face values stay within 0..1', inRange);
  // in flight: no chirps, but each flap pops the beak open; after a crash the eyes half shut and the beak hangs open
  const r = run([0.5, 1.5], 3, 2.2);
  const nearFlap = Math.max(...r.outs.slice(Math.round(0.5 / DT), Math.round(0.75 / DT)).map((o) => o.beak));
  const quiet = Math.max(...r.outs.slice(Math.round(1.0 / DT), Math.round(1.45 / DT)).map((o) => o.beak));
  const end = r.outs[r.outs.length - 1];
  check('flight: each flap pops the beak open, and it closes again between flaps', nearFlap > 0.3 && quiet < 0.05, `peak ${nearFlap.toFixed(2)}, between ${quiet.toFixed(3)}`);
  check('crash: eyes half shut, beak hangs open', end.eyes > 0.6 && end.beak > 0.4, `eyes ${end.eyes.toFixed(2)}, beak ${end.beak.toFixed(2)}`);
}

console.log(failures ? `\n${failures} failed` : '\nflamebird motion tests passed');
process.exit(failures ? 1 : 0);
