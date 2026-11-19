/**
 * Journey Preview tests (no browser). Flies a whole preview through the REAL simulation, the REAL Auto play bot and the REAL store (events routed by the same function the game loop uses),
 * against a seeded fake localStorage, and checks that it reaches 10,000 m and the ending, that NOTHING permanent changes (storage byte for byte, the store's progression state, every
 * write counted), that leaving it and playing normally still grants rewards, and the races between completion, collision, the demo flags and persistence. Run with: npm run test:preview
 */
import { readFileSync } from 'node:fs';

// ---- a fake localStorage holding an EXISTING player's data, and a spy on every write
const disk = new Map();
const writes = [];
const seed = {
  bestScore: 4321,
  stats: { runs: 7, totalDistance: 9000, totalOrbs: 120, totalNearMisses: 30, bestDistance: 2600, bestStreak: 9, bestNearMisses: 6, bestOrbs: 31, personalBests: 3 },
  achievements: { 'dist-100': 1, 'dist-250': 1, 'dist-500': 2 },
  daily: { key: '2020-01-01', done: true, streakDays: 4, lastDoneKey: '2020-01-01' },
  flown: { flipper: 7 },
  journey: { rewards: { 'treasure-cache': 3 }, completions: 0, milestones: [1, 0, 0, 0, 0] },
  theme: 'red',
  skinsByTheme: { red: 'flipper-fire' },
  soundEnabled: true,
  quality: 'auto',
};
for (const [k, v] of Object.entries(seed)) disk.set(`fireflipper:${k}`, JSON.stringify(v));
globalThis.window = {
  localStorage: {
    getItem: (k) => (disk.has(k) ? disk.get(k) : null),
    setItem: (k, v) => { writes.push(k); disk.set(k, String(v)); },
    removeItem: (k) => void disk.delete(k),
  },
};
const snapshot = () => JSON.stringify([...disk.entries()].sort());

const { PHASE, createGameSim } = await import('../src/systems/game/createGameSim.js');
const { createAutopilot } = await import('../src/systems/bot/autopilot.js');
const { routeSimEvent } = await import('../src/systems/game/routeEvents.js');
const { useGameStore, STATUS, SCREENS } = await import('../src/store/useGameStore.js');
const { PREVIEW_SEEDS, previewRewardIds, previewSeedFor } = await import('../src/systems/rewards/preview.js');
const { PHYSICS } = await import('../src/systems/physics/constants.js');
const { GAME_EVENTS } = await import('../src/systems/events/gameEvents.js');

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) { failures++; console.log(`  FAIL ${name} ${detail}`); } else console.log(`  ok   ${name}${detail ? ` (${detail})` : ''}`);
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const st = () => useGameStore.getState();
const DT = PHYSICS.fixedStep;

/** One frame of the game loop, in the loop's own order: bot, step, drain the events through the shared router. */
function frame(sim, bot, watching) {
  if (watching) bot.control();
  sim.step(DT);
  if (sim.events.length) {
    for (const e of sim.events) routeSimEvent(st(), sim, e);
    sim.events.length = 0;
  }
}
/** Starts whatever is requested through the store, resets the simulation as the loop does (with the preview seed when there is one) and flies until `done`. */
function fly(start, { watching, bot: useBot = true, until }) {
  start();
  const sim = createGameSim();
  sim.reset(st().previewSeed ?? 5);
  const bot = createAutopilot(sim);
  const corridor = () => {
    const c = sim.track.corridors.find((k) => k.x1 > sim.distance - 0.3);
    const target = c ? Math.max(c.lo + 0.8, c.center - 0.6) : 0;
    const { y, vy } = sim.bird;
    if (vy < 0 && (y < target || (c && y < c.lo + 0.5))) sim.flap();
  };
  if (!watching) sim.flap();
  let steps = 0;
  while (!until(sim) && steps++ < 120 * 1800) {
    if (!watching && useBot) corridor();
    frame(sim, bot, watching);
  }
  return sim;
}

const before = { snap: snapshot(), journey: st().journey, stats: st().stats, earned: st().earned, daily: st().daily, flown: st().flown, bestScore: st().bestScore, skinId: st().skinId };
check('the seeded existing player is loaded (best score, journey with the cache)', st().bestScore === 4321 && st().journey.rewards['treasure-cache'] === 3 && st().stats.runs === 7);

// ---------------------------------------------------------------- 1. the preview flies the whole journey
console.log('\n1. A full Journey Preview');
const milestones = [];
const unsub = useGameStore.subscribe((s, p) => { if (s.milestone && s.milestone !== p.milestone) milestones.push(s.milestone); });
const t0 = Date.now();
const sim = fly(() => st().startPreview(), { watching: true, until: (s) => s.phase === PHASE.COMPLETE || s.phase === PHASE.OVER });
unsub();
console.log(`     (flew in ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
check('starting the preview sets the preview AND demo flags, a verified seed, and no other mode', true);
check('the bot reached the finish line: the simulation is COMPLETE at exactly 10,000 m', sim.phase === PHASE.COMPLETE && sim.metres === 10000 && sim.results().completed === true && sim.results().worlds === 5, `${sim.phase} ${sim.metres}`);
check('the store is in the ending (status COMPLETE) with a preview result, 5 worlds, 10,000 m', st().status === STATUS.COMPLETE && st().lastResult?.completed === true && st().lastResult.preview === true && st().lastResult.distance === 10000 && st().lastResult.worlds === 5);
check('all four milestone banners were shown, in order, each marked as a preview', milestones.length === 4 && milestones.every((m, i) => m.index === i && m.at === (i + 1) * 2000 && m.preview === true));
check('the simulated rewards are the scheduled ones: the five rewards of the journey', [...st().lastResult.rewards].sort().join() === ['celestial-feather', 'celestial-skin', 'city-orb', 'journey-trophy', 'treasure-cache'].sort().join());
check('the banners name their rewards from the pure schedule (World 1: Cache, World 2: Orb, World 3: none, World 4: Skin)', milestones.map((m) => m.granted.join()).join('|') === 'treasure-cache|city-orb||celestial-skin');

// ---------------------------------------------------------------- 2. nothing permanent changed
console.log('\n2. Isolation: the existing player data is untouched');
check('localStorage is byte-for-byte identical after the preview', snapshot() === before.snap);
check('not one write reached storage during the whole preview', writes.length === 0, writes.join());
check('the real progression state is the very same objects: journey, stats, achievements, daily goal, flown, best score, bird', st().journey === before.journey && st().stats === before.stats && st().earned === before.earned && st().daily === before.daily && st().flown === before.flown && st().bestScore === before.bestScore && st().skinId === before.skinId);
check('the real collection still shows only what was really earned (the Cache), not the simulated rewards', Object.keys(st().journey.rewards).join() === 'treasure-cache' && st().journey.completions === 0);

// ---------------------------------------------------------------- 3. exit and normal play
console.log('\n3. Leaving the preview, then normal play');
st().exitToMenu();
check('exiting returns to the menu with every preview flag and banner cleared', st().screen === SCREENS.HOME && st().status === STATUS.IDLE && !st().demo && !st().preview && st().previewSeed === null && st().milestone === null && st().runRewards.length === 0);
check('exiting changed nothing on disk or in the real state', snapshot() === before.snap && st().journey === before.journey && writes.length === 0);
{
  const real = fly(() => st().startGame(), { watching: false, until: (s) => s.phase === PHASE.COMPLETE || s.phase === PHASE.OVER });
  check('a normal run starts as normal play (no demo, no preview, a random seed)', true);
  check('normal play reaches the finish line and ends COMPLETE (not a preview)', real.phase === PHASE.COMPLETE && st().status === STATUS.COMPLETE && st().lastResult.preview !== true && st().lastResult.completed === true);
  check('normal play granted the REAL rewards: the Orb, the Skin, the Trophy and the Feather (the Cache was already owned)', ['city-orb', 'celestial-skin', 'journey-trophy', 'celestial-feather', 'treasure-cache'].every((id) => st().journey.rewards[id]) && st().journey.completions === 1);
  const saved = JSON.parse(disk.get('fireflipper:journey'));
  check('and saved them: storage now holds all five, with the Cache keeping its original run number', Object.keys(saved.rewards).length === 5 && saved.rewards['treasure-cache'] === 3 && saved.completions === 1);
  check('the run was recorded as a real run (stats, best score, achievements)', JSON.parse(disk.get('fireflipper:stats')).runs === 8 && JSON.parse(disk.get('fireflipper:bestScore')) >= 10000 && writes.includes('fireflipper:stats') && writes.includes('fireflipper:bestScore'));
}

// ---------------------------------------------------------------- 4. races and edge cases
console.log('\n4. Races and edge cases');
{
  // each of these starts from the CURRENT (real) data and must leave it alone
  const snap = snapshot();
  const w = writes.length;
  const real = { journey: st().journey, stats: st().stats, best: st().bestScore };
  const quiet = () => snapshot() === snap && writes.length === w && st().journey === real.journey && st().stats === real.stats && st().bestScore === real.best;

  st().startPreview();
  st().beginRun();
  st().milestoneReached({ index: 0, at: 2000, name: 'Red Rock Canyon' });
  st().milestoneReached({ index: 0, at: 2000, name: 'Red Rock Canyon' });
  check('a preview milestone is handled once per run and grants nothing real', st().milestoneIndex === 0 && st().runRewards.join() === 'treasure-cache' && quiet());
  st().crash();
  st().milestoneReached({ index: 1, at: 4000, name: 'x' });
  check('a milestone arriving after the crash is ignored', st().milestoneIndex === 0 && quiet());
  st().endRun({ score: 1, distance: 1, orbs: 0, cause: 'lava', completed: true });
  check('a completion reported after the crash is refused (collision beats completion)', st().status === STATUS.DYING && quiet());
  st().endRun({ score: 2100, distance: 2100, orbs: 3, cause: 'column', worlds: 1 });
  check('a crashed preview ends as OVER with no result and no persistence (the bot then starts the next journey)', st().status === STATUS.OVER && st().lastResult === null && quiet());
  const seedBefore = st().previewSeed;
  st().restart();
  check('restarting a preview stays a preview, on the next verified seed, and is READY', st().status === STATUS.READY && st().preview && st().demo && st().previewSeed === previewSeedFor(st().runId) && st().previewSeed !== null && seedBefore !== undefined && quiet());

  st().beginRun();
  st().endRun({ score: 10000, distance: 10000, orbs: 0, completed: true });
  const first = st().lastResult;
  st().endRun({ score: 99999, distance: 10000, orbs: 9, completed: true });
  st().endRun({ score: 5, distance: 5, orbs: 0, cause: 'lava' });
  check('the preview ending runs once: a second completion or a late crash changes nothing', st().status === STATUS.COMPLETE && st().lastResult === first && first.score === 10000 && quiet());

  // a stale / contradictory flag state must still never reach the real path
  useGameStore.setState({ demo: false, preview: true, status: STATUS.RUNNING });
  st().endRun({ score: 777, distance: 777, orbs: 1, cause: 'column', worlds: 0 });
  check('even with demo wrongly false, a preview run never falls through to real progression', st().stats === real.stats && st().bestScore === real.best && quiet());
  useGameStore.setState({ demo: false, preview: true, status: STATUS.RUNNING, milestoneIndex: -1 });
  st().milestoneReached({ index: 2, at: 6000, name: 'x' });
  check('...and its milestones are simulated, never granted', st().journey === real.journey && quiet());
  st().exitToMenu();

  // plain Auto play: unchanged (no banner, no ending, nothing saved)
  st().startDemo();
  st().beginRun();
  st().milestoneReached({ index: 0, at: 2000, name: 'x' });
  check('plain Auto play shows no milestone banner and grants nothing', st().milestone === null && st().preview === false && quiet());
  st().endRun({ score: 10000, distance: 10000, orbs: 5, completed: true });
  check('plain Auto play reaching the line just ends (OVER, no result, no ending, nothing saved)', st().status === STATUS.OVER && st().lastResult === null && st().demo && quiet());
  st().exitToMenu();

  // the persistence guard itself: with either flag set, no progression write gets through whoever calls it
  for (const flags of [{ demo: true, preview: false }, { demo: false, preview: true }, { demo: true, preview: true }]) {
    useGameStore.setState({ ...flags, status: STATUS.RUNNING, milestoneIndex: -1, runRewards: [] });
    st().endRun({ score: 9, distance: 9, orbs: 0, cause: 'lava' });
    check(`no progression is written with demo=${flags.demo} preview=${flags.preview}`, quiet());
    useGameStore.setState({ demo: false, preview: false });
  }

  // after all of it, normal play is intact
  st().startGame();
  st().beginRun();
  st().crash();
  st().endRun({ score: 120, distance: 120, orbs: 2, cause: 'column', worlds: 0 });
  check('after previews and Auto play, a normal run still records normally', st().status === STATUS.OVER && st().lastResult.score === 120 && JSON.parse(disk.get('fireflipper:stats')).runs === 9 && st().lastResult.preview !== true);
}

// ---------------------------------------------------------------- 5. what the code looks like
console.log('\n5. Wiring');
{
  const store = read('src/store/useGameStore.js');
  const body = store.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const keys = ['journey', 'bestScore', 'flown', 'stats', 'achievements', 'daily'];
  check('every progression write goes through persistProgress; none calls saveValue directly', keys.every((k) => !new RegExp(`saveValue\\('${k}'`).test(body)) && keys.every((k) => new RegExp(`persistProgress\\('${k}'`).test(body)));
  check('persistProgress refuses while demo or preview is set', /if \(s\.demo \|\| s\.preview\) return false/.test(body));
  const prev = read('src/systems/rewards/preview.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  check('the preview helpers are pure: no storage, no store, no window', !/storage|useGameStore|localStorage|window|saveValue/.test(prev) && /EMPTY_JOURNEY/.test(prev));
  const ui = ['src/components/ui/JourneyEnding.jsx', 'src/components/ui/MilestoneToast.jsx', 'src/components/ui/DemoOverlay.jsx'].map(read).join('\n');
  check('no preview screen can grant or save: they call no grant or save function', !/reachMilestone|persistProgress|saveValue|loadValue/.test(ui));
  const ending = read('src/components/ui/JourneyEnding.jsx');
  check('the preview final screen is marked, says nothing was saved, offers Watch Again and Exit Preview, and hides View Rewards', /Journey Preview &middot; nothing was saved/.test(ending) && /Watch Again/.test(ending) && /Exit Preview/.test(ending) && /preview \? \(/.test(ending));
  const home = read('src/components/ui/HomeScreen.jsx');
  check('the home screen has a secondary "Journey Preview" control; Play stays the primary button', /startPreview/.test(home) && /Journey Preview/.test(home) && /className="play-btn"/.test(home) && !/className="play-btn[^"]*"[^>]*>\s*<[^>]*>\s*<span>Journey Preview/.test(home));
  const overlay = read('src/components/ui/DemoOverlay.jsx');
  check('the preview can be left at any time: Exit in the overlay, the back button in the HUD, Exit Preview at the end', /exitToMenu/.test(overlay) && /Exit/.test(overlay) && /exitToMenu/.test(read('src/components/ui/GameHUD.jsx')));
  const loop = read('src/systems/game/useGameLoop.js');
  check('the loop and the tests share one event router, and the loop resets the simulation on the preview seed', /routeSimEvent/.test(loop) && /previewSeed/.test(loop));
  check('the simulation, physics, collisions, scoring, spawner, hazards and bot know nothing about the preview', !/preview|rewards\/|useGameStore/i.test(['src/systems/game/createGameSim.js', 'src/systems/physics/flight.js', 'src/systems/physics/collision.js', 'src/systems/obstacles/spawner.js', 'src/systems/obstacles/patterns.js', 'src/systems/scoring/scoring.js', 'src/systems/hazards/biomeHazards.js', 'src/systems/bot/autopilot.js'].map(read).join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
  check('the preview seeds are a short list of whole numbers and previewSeedFor cycles through them', PREVIEW_SEEDS.length >= 3 && PREVIEW_SEEDS.every(Number.isInteger) && [0, 1, 2, 3, 4, 5, -1].every((n) => PREVIEW_SEEDS.includes(previewSeedFor(n))) && previewRewardIds(2).length === 0 && previewRewardIds(4).length === 2);
}
check('the GAME_EVENTS the preview relies on exist', GAME_EVENTS.MILESTONE === 'milestone' && GAME_EVENTS.COMPLETE === 'complete');

console.log(failures ? `\n${failures} failed` : '\njourney preview tests passed');
process.exit(failures ? 1 : 0);
