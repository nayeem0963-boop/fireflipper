/**
 * Auto play tests. Run with: npm run test:autoplay
 * The owner asked for Auto play to stay in every future version, so this also guards that the feature is wired in
 * (store flag, home button, loop hook, docs). If you are asked to remove it, remove this test with it.
 */
import { readFileSync } from 'node:fs';
import { createGameSim, PHASE } from '../src/systems/game/createGameSim.js';
import { createAutopilot } from '../src/systems/bot/autopilot.js';
import { PHYSICS } from '../src/systems/physics/constants.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
};

// The bot flies real generated tracks without crashing.
const TARGET = 1500;
const SEEDS = 12;
let survived = 0;
let orbs = 0;
let maxMs = 0;
const crashes = [];
for (let seed = 1; seed <= SEEDS; seed++) {
  const sim = createGameSim();
  sim.reset(seed);
  const bot = createAutopilot(sim);
  let steps = 0;
  while (sim.phase !== PHASE.DYING && sim.phase !== PHASE.OVER && sim.distance < TARGET && steps < 120 * 400) {
    bot.control();
    sim.step(PHYSICS.fixedStep);
    steps++;
  }
  orbs += sim.orbsCollected;
  maxMs = Math.max(maxMs, bot.stats.maxMs);
  if (sim.distance >= TARGET) survived++;
  else crashes.push(`seed ${seed} @ ${sim.metres} m (${sim.crashCause})`);
}
console.log(`  bot survived ${survived}/${SEEDS} runs to ${TARGET} m, avg ${(orbs / SEEDS).toFixed(0)} orbs, slowest plan ${maxMs.toFixed(1)} ms`);
crashes.forEach((c) => console.log(`    crash: ${c}`));
check('bot survives every track', survived === SEEDS);
check('bot collects orbs', orbs / SEEDS > 5);
check('planning is cheap (<40 ms, generous: CI machines vary)', maxMs < 40, `${maxMs.toFixed(1)} ms`);

// The feature stays wired in.
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
check('store has demo mode', /startDemo/.test(read('src/store/useGameStore.js')));
check('home has the Auto play button', /Auto play/i.test(read('src/components/ui/HomeScreen.jsx')));
check('game loop runs the bot', /autopilot|bot\.control/i.test(read('src/systems/game/useGameLoop.js')));
check('CLAUDE.md keeps the instruction', /auto play/i.test(read('CLAUDE.md')));

console.log(failures ? `\n${failures} failed` : '\nauto play tests passed');
process.exit(failures ? 1 : 0);
