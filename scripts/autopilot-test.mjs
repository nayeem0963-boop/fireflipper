/**
 * Autopilot tests. Run with: npm run test:bot
 *
 * Drives the REAL simulation with the REAL fixed-step driver and the autopilot, frame by frame, the way the
 * game does, and checks the bot survives long runs, on slow frame rates, and after being warped ahead.
 *
 *   node scripts/autopilot-test.mjs [seeds=8] [metres=3000]
 */
import { createGameSim, PHASE } from '../src/systems/game/createGameSim.js';
import { createStepper } from '../src/systems/game/fixedStep.js';
import { createAutopilot, LAYERS } from '../src/systems/bot/autopilot.js';
import { BOUNDARIES } from '../src/systems/world/environments.js';

const SEEDS = Number(process.argv[2]) || 8;
const TARGET = Number(process.argv[3]) || 3000;
let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
};

/** One run: frames of 1/fps, one planning layer per frame (the slowest a device can be), until death or target. */
function run(seed, { fps = 60, budget = 0, target = TARGET, warps = [], layerMs = 0 } = {}) {
  const sim = createGameSim();
  sim.reset(seed);
  const bot = createAutopilot(sim);
  sim.controller = () => bot.control();
  const stepper = createStepper(sim);
  const frame = 1 / fps;
  const out = { seed, survived: false, metres: 0, orbs: 0, gems: 0, nearMisses: 0, best: 0, taps: 0, frames: 0, planMs: 0 };
  const pendingWarps = [...warps];
  let guard = 0;
  while (sim.phase !== PHASE.DYING && sim.phase !== PHASE.OVER && sim.distance < target && guard++ < fps * 900) {
    stepper.advance(frame);
    for (const e of sim.events) if (e.type === 'flap') out.taps++;
    sim.events.length = 0;
    // `layerMs` models a device where one planning layer costs that long: the game's budget is max(3, 250 x frame) ms.
    if (layerMs > 0) bot.think(Infinity, frame, Math.max(1, Math.floor(Math.min(12, Math.max(3, frame * 250)) / layerMs)));
    else bot.think(budget, frame);
    if (pendingWarps.length && sim.runTime > 3 && sim.distance >= pendingWarps[0].after) {
      const w = pendingWarps.shift();
      sim.warpTo(w.to);
      bot.planNow();
    }
    out.frames++;
  }
  out.survived = sim.distance >= target;
  out.metres = Math.round(sim.distance);
  out.orbs = sim.orbsCollected;
  out.gems = sim.gemsCollected;
  out.nearMisses = sim.nearMisses;
  out.best = sim.streak.best;
  out.planMs = bot.stats.layers ? bot.stats.ms / bot.stats.layers : 0;
  out.plans = bot.stats.plans;
  out.dead = bot.stats.dead;
  out.phase = sim.phase;
  return out;
}

console.log(`search: ${LAYERS} decisions (${LAYERS / 10} s) ahead`);
console.log(`\nSurviving ${TARGET} m at 60 fps, one planning layer per frame (slowest case)`);
let ok = 0;
let ms = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
  const r = run(seed);
  ms += r.planMs;
  if (r.survived) ok++;
  console.log(`  seed ${seed}: ${r.survived ? 'survived' : 'CRASHED at ' + r.metres + ' m'} (${r.orbs} orbs, ${r.gems} gems, ${r.nearMisses} near misses, longest streak ${r.best}, ${r.taps} taps, ${r.plans} plans)`);
  check(`seed ${seed} survives ${TARGET} m`, r.survived, `died at ${r.metres}`);
}
console.log(`  ${ok}/${SEEDS} survived; planning costs ${(ms / SEEDS).toFixed(2)} ms per layer on this machine`);

console.log('\nSlow devices: a layer costs 5 ms (about 4x this machine, a mid-range phone), at 60, 30 and 20 fps');
for (const fps of [60, 30, 20]) {
  let n = 0;
  const N = Math.min(4, SEEDS);
  for (let seed = 1; seed <= N; seed++) if (run(seed, { fps, target: 2000, layerMs: 5 }).survived) n++;
  console.log(`  ${fps} fps: ${n}/${N} survived 2,000 m`);
  check(`${fps} fps survives`, n === N, `${n}/${N}`);
}

console.log('\nFast device: plenty of planning per frame');
{
  let n = 0;
  const N = Math.min(4, SEEDS);
  for (let seed = 1; seed <= N; seed++) if (run(seed, { budget: 50, target: 2000 }).survived) n++;
  console.log(`  ${n}/${N} survived 2,000 m`);
  check('unlimited budget survives', n === N);
}

console.log('\nWarped ahead into each later environment');
{
  let n = 0;
  let total = 0;
  for (let seed = 1; seed <= Math.min(6, SEEDS); seed++) {
    for (const b of BOUNDARIES) {
      total++;
      const r = run(seed, { target: b + 400, warps: [{ after: 0, to: b - 30 }] });
      if (r.survived) n++;
      else console.log(`  seed ${seed}: crashed after warping to ${b - 30} m (at ${r.metres} m)`);
    }
  }
  console.log(`  ${n}/${total} survived 400 m after a warp`);
  check('survives after warps', n === total, `${n}/${total}`);
}

console.log(failures ? `\n${failures} FAILED` : '\nall autopilot checks passed');
process.exit(failures ? 1 : 0);
