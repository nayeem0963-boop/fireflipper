// Biome hazard soak (not part of test:all: it takes minutes). Run with: npm run test:hazards-soak
// Larger seed counts for both bots with the hazards on, and the CPU cost of the hazards in the simulation step.
import { PHASE, createGameSim } from '../src/systems/game/createGameSim.js';
import { createAutopilot } from '../src/systems/bot/autopilot.js';
import { PHYSICS } from '../src/systems/physics/constants.js';
import { HAZARDS, createHazardFx, createObstacleFx, hazardsAt, obstacleHazard } from '../src/systems/hazards/biomeHazards.js';

const DT = PHYSICS.fixedStep;
HAZARDS.enabled = true;
let failed = 0;
const report = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`); };

function corridorBot(seed, upto) {
  const sim = createGameSim();
  sim.reset(seed);
  sim.flap();
  let steps = 0;
  while (sim.phase === PHASE.RUNNING && sim.distance < upto && steps++ < 120 * 1500) {
    const c = sim.track.corridors.find((k) => k.x1 > sim.distance - 0.3);
    const target = c ? Math.max(c.lo + 0.8, c.center - 0.6) : 0;
    const { y, vy } = sim.bird;
    if (vy < 0 && (y < target || (c && y < c.lo + 0.5))) sim.flap();
    sim.step(DT);
  }
  return sim;
}

// 1. the corridor-following bot, 60 seeds, 8 km (every zone and into the endless Cloud Sanctuary)
{
  const N = 60, TARGET = 8000;
  let ok = 0;
  const crashes = [];
  for (let seed = 100; seed < 100 + N; seed++) {
    const sim = corridorBot(seed, TARGET);
    if (sim.distance >= TARGET) ok++;
    else crashes.push(`seed ${seed} @ ${sim.metres} m (${sim.crashCause}, ${sim.hazard.kind || 'no window'})`);
  }
  crashes.slice(0, 6).forEach((c) => console.log(`     crash: ${c}`));
  report(`corridor-following bot: ${ok}/${N} seeds to ${TARGET} m with the hazards on`, ok === N);
}

// 2. Auto play, 10 seeds, 5.6 km (it plans with the hazards: pistons, barriers, windows)
{
  const N = 10, TARGET = 5600;
  let ok = 0, orbs = 0, maxMs = 0;
  const crashes = [];
  const plans = []; // milliseconds of every step that planned (run this alone: a busy machine inflates it)
  for (let seed = 200; seed < 200 + N; seed++) {
    const sim = createGameSim();
    sim.reset(seed);
    const bot = createAutopilot(sim);
    let steps = 0;
    while (sim.phase !== PHASE.DYING && sim.phase !== PHASE.OVER && sim.distance < TARGET && steps++ < 120 * 1500) {
      const t0 = performance.now();
      bot.control();
      const ms = performance.now() - t0;
      if (ms > 0.5) plans.push(ms);
      sim.step(DT);
    }
    orbs += sim.orbsCollected;
    maxMs = Math.max(maxMs, bot.stats.maxMs);
    if (sim.distance >= TARGET) ok++;
    else crashes.push(`seed ${seed} @ ${sim.metres} m (${sim.crashCause})`);
  }
  crashes.forEach((c) => console.log(`     crash: ${c}`));
  plans.sort((a, b) => a - b);
  const q = (p) => plans[Math.min(plans.length - 1, Math.floor(p * plans.length))];
  console.log(`     plans: median ${q(0.5).toFixed(2)} ms, p99 ${q(0.99).toFixed(2)} ms, max ${maxMs.toFixed(1)} ms over ${plans.length} plans`);
  report(`Auto play: ${ok}/${N} seeds to ${TARGET} m with the hazards on (avg ${(orbs / N).toFixed(0)} orbs; planning p99 ${q(0.99).toFixed(1)} ms must stay under 15)`, ok === N && q(0.99) < 15);
}

// 3. CPU cost per simulation step, hazards off and on, on real tracks (the bird is controlled by the corridor bot, whose own cost is the same in both)
{
  const time = (enabled) => {
    HAZARDS.enabled = enabled;
    let steps = 0;
    const t0 = performance.now();
    for (const seed of [1, 2, 3, 4]) {
      const sim = createGameSim();
      sim.reset(seed);
      sim.flap();
      while (sim.phase === PHASE.RUNNING && sim.distance < 6000) {
        const c = sim.track.corridors.find((k) => k.x1 > sim.distance - 0.3);
        const target = c ? Math.max(c.lo + 0.8, c.center - 0.6) : 0;
        const { y, vy } = sim.bird;
        if (vy < 0 && (y < target || (c && y < c.lo + 0.5))) sim.flap();
        sim.step(DT);
        steps++;
      }
    }
    HAZARDS.enabled = true;
    return { us: ((performance.now() - t0) * 1000) / steps, steps };
  };
  time(false); time(true); // warm up
  const off = time(false);
  const on = time(true);
  const extra = on.us - off.us;
  console.log(`     per step: ${off.us.toFixed(2)} us off, ${on.us.toFixed(2)} us on (${extra >= 0 ? '+' : ''}${extra.toFixed(2)} us), ${on.steps} steps`);
  report(`the hazards add ${extra.toFixed(2)} us to a 120 Hz step (8.3 ms per step budget at 120 Hz is 8333 us: ${((100 * Math.max(0, extra)) / 8333).toFixed(3)}%)`, extra < 50);
  // the two pure functions on their own
  const fx = createHazardFx(), ob = createObstacleFx();
  const o = { x: 3100, kind: 'column', cap: 1 };
  const t1 = performance.now();
  for (let i = 0; i < 400000; i++) hazardsAt(3000 + (i % 2000) * 0.05, fx, []);
  const a = ((performance.now() - t1) * 1000) / 400000;
  const t2 = performance.now();
  for (let i = 0; i < 400000; i++) obstacleHazard(o, 3000 + (i % 2000) * 0.05, ob);
  const b = ((performance.now() - t2) * 1000) / 400000;
  console.log(`     hazardsAt ${a.toFixed(3)} us/call, obstacleHazard ${b.toFixed(3)} us/call`);
  report('both hazard functions are microsecond-cheap (each under 2 us)', a < 2 && b < 2);
}
console.log(failed ? `\n${failed} soak check(s) failed` : '\nhazard soak passed');
process.exit(failed ? 1 : 0);
