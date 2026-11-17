/**
 * Balance harness. Run with: npm run balance [-- --runs=60]
 *
 * Plays many seeded runs with simulated players of different skill and prints how runs end:
 * where players die and to what, how much of the score comes from orbs, and how often
 * near-misses and power-ups happen. It reports numbers; it asserts nothing (use it to
 * tune, then check the result with test:sim).
 *
 * Skill model: every `reaction` seconds the bot decides whether to flap, aiming at the
 * current corridor with a wandering aim error; it also skips some flaps. Novices have more
 * aim error and more skipped flaps and react slower.
 */
import { createGameSim, PHASE } from '../src/systems/game/createGameSim.js';
import { PHYSICS } from '../src/systems/physics/constants.js';
import { createRng } from '../src/utils/random.js';
import { SCORING } from '../src/systems/physics/constants.js';

const DT = PHYSICS.fixedStep;
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};
const RUNS = arg('runs', 60);
const MAX_METRES = arg('max', 5000);

const SKILLS = [
  { name: 'novice', reaction: 0.26, aimError: 0.9, skip: 0.3 },
  { name: 'casual', reaction: 0.2, aimError: 0.6, skip: 0.15 },
  { name: 'skilled', reaction: 0.14, aimError: 0.35, skip: 0.05 },
  { name: 'expert', reaction: 0.1, aimError: 0.15, skip: 0.01 },
];

function playRun(seed, skill) {
  const sim = createGameSim();
  sim.reset(seed);
  const rng = createRng(seed ^ 0x9e3779b9);
  const decisionEvery = Math.max(1, Math.round(skill.reaction / DT));
  const counts = { powerup: 0, shieldBreak: 0 };
  let aim = 0;
  sim.flap();
  let tick = 0;
  while (sim.phase !== PHASE.OVER && sim.distance < MAX_METRES && tick < 120 * 900) {
    if (sim.phase === PHASE.RUNNING) {
      if (tick % decisionEvery === 0) {
        // The aim error drifts instead of re-rolling, like a player's wandering sense of height.
        aim += (rng.range(-1, 1) * skill.aimError - aim) * 0.5;
        const c = sim.track.corridors.find((k) => k.x1 > sim.distance - 0.3);
        const target = c ? Math.max(c.lo + 0.8, c.center - 0.6 + aim) : 0;
        const { y, vy } = sim.bird;
        const wantsFlap = vy < 0 && (y < target || (c && y < c.lo + 0.5));
        if (wantsFlap && !rng.chance(skill.skip)) sim.flap();
      }
    }
    sim.step(DT);
    for (const e of sim.events) {
      if (e.type === 'powerup') counts.powerup++;
      else if (e.type === 'shieldBreak') counts.shieldBreak++;
    }
    sim.events.length = 0;
    tick++;
  }
  // The pattern the bird was in when it died (the corridor nearest to the crash).
  const c = sim.track.corridors.find((k) => k.x1 > sim.scoredDistance - 0.3);
  return {
    sim,
    counts,
    pattern: c?.type ?? 'unknown',
    survived: sim.phase !== PHASE.OVER && sim.distance >= MAX_METRES,
  };
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
const fmt = (n, d = 0) => n.toFixed(d);
const bar = (share, width = 20) => '#'.repeat(Math.round(share * width)).padEnd(width, '.');
const BUCKETS = [0, 100, 250, 500, 1000, 1500, 2500, Infinity];

console.log(`Balance report: ${RUNS} seeded runs per skill level (cap ${MAX_METRES} m)\n`);
const started = Date.now();

for (const skill of SKILLS) {
  const rows = [];
  for (let i = 0; i < RUNS; i++) rows.push(playRun(1000 + i * 7919, skill));

  const metres = rows.map((r) => r.sim.metres).sort((a, b) => a - b);
  const seconds = rows.map((r) => r.sim.time).sort((a, b) => a - b);
  const total = (f) => rows.reduce((s, r) => s + f(r), 0);
  const orbScore = total((r) => r.sim.orbsCollected * SCORING.orbPoints);
  const bonus = total((r) => r.sim.bonus);
  const distScore = total((r) => r.sim.metres);
  const scoreSum = orbScore + bonus + distScore;
  const lava = rows.filter((r) => r.sim.death?.cause === 'lava').length;
  const obstacle = rows.filter((r) => r.sim.death?.cause === 'obstacle').length;
  const survived = rows.filter((r) => r.survived).length;

  console.log(
    `== ${skill.name} (reaction ${skill.reaction}s, aim error ${skill.aimError}, skips ${skill.skip * 100}%)`,
  );
  console.log(
    `   distance   p10 ${fmt(pct(metres, 10))} m   median ${fmt(pct(metres, 50))} m   p90 ${fmt(pct(metres, 90))} m` +
      (survived ? `   (${survived} reached the cap)` : ''),
  );
  console.log(`   time alive median ${fmt(pct(seconds, 50))} s   p90 ${fmt(pct(seconds, 90))} s`);
  console.log(
    `   deaths     lava ${lava}   obstacle ${obstacle}` + (survived ? `   alive at cap ${survived}` : ''),
  );
  console.log(
    `   score mix  distance ${fmt((100 * distScore) / scoreSum)}%   orbs ${fmt((100 * orbScore) / scoreSum)}%   near-miss ${fmt((100 * bonus) / scoreSum)}%`,
  );
  console.log(
    `   per run    orbs ${fmt(total((r) => r.sim.orbsCollected) / RUNS, 1)}   near misses ${fmt(total((r) => r.sim.nearMisses) / RUNS, 1)} (${fmt((100 * total((r) => r.sim.nearMisses)) / Math.max(1, distScore), 1)} per 100 m)   power-ups ${fmt(total((r) => r.counts.powerup) / RUNS, 1)}   shield saves ${fmt(total((r) => r.counts.shieldBreak) / RUNS, 1)}`,
  );

  console.log('   where runs end:');
  for (let b = 0; b < BUCKETS.length - 1; b++) {
    const n = rows.filter(
      (r) => r.sim.metres >= BUCKETS[b] && r.sim.metres < BUCKETS[b + 1] && !r.survived,
    ).length;
    const label = BUCKETS[b + 1] === Infinity ? `${BUCKETS[b]}+ m` : `${BUCKETS[b]}-${BUCKETS[b + 1]} m`;
    console.log(`     ${label.padEnd(11)} ${bar(n / RUNS)} ${n}`);
  }

  const byPattern = {};
  for (const r of rows) if (!r.survived) byPattern[r.pattern] = (byPattern[r.pattern] ?? 0) + 1;
  const patterns = Object.entries(byPattern).sort((a, b) => b[1] - a[1]);
  console.log(`   killed in  ${patterns.map(([k, n]) => `${k} ${n}`).join(', ') || 'n/a'}\n`);
}
console.log(`(${((Date.now() - started) / 1000).toFixed(1)} s)`);
