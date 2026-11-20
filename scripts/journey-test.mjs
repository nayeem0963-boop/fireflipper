/**
 * Journey tests (no browser): the five 2,000 m worlds, the difficulty curve, the milestones and the ending in the simulation, and the rewards (unlock rules, persistence,
 * once-only grants). Run with: npm run test:journey
 */
import { readFileSync } from 'node:fs';

// A browser-like storage for the store's persistence tests. It must exist BEFORE the store module is first imported.
const disk = new Map();
globalThis.window = { localStorage: { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => void disk.set(k, String(v)), removeItem: (k) => void disk.delete(k) } };

const { PHASE, createGameSim } = await import('../src/systems/game/createGameSim.js');
const { GAME_EVENTS } = await import('../src/systems/events/gameEvents.js');
const { PHYSICS, WORLD } = await import('../src/systems/physics/constants.js');
const { difficultyAt } = await import('../src/systems/obstacles/spawner.js');
const { speedAt } = await import('../src/systems/physics/speed.js');
const { UNLOCK } = await import('../src/systems/obstacles/patterns.js');
const { BIOMES, ZONE_IDS, biomeAt } = await import('../src/systems/world/biomes.js');
const { KIT_STARTS, rockKit } = await import('../src/systems/obstacles/rockShapes.js');
const { zoneAt } = await import('../src/systems/hazards/biomeHazards.js');
const { FLIERS } = await import('../src/systems/fliers/fliers.js');
// This test flies a corridor-following bird, which cannot dodge the flying hazards (systems/fliers): they are switched off here and covered by scripts/fliers-test.mjs.
FLIERS.enabled = false;
const W = await import('../src/systems/world/worlds.js');
const R = await import('../src/systems/rewards/rewards.js');
const { getAvatar, resolveAvatar, isAvatarUnlocked, AVATARS, REWARD_AVATARS } = await import('../src/systems/avatars/avatars.js');

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  } else console.log(`  ok   ${name}${detail ? ` (${detail})` : ''}`);
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DT = PHYSICS.fixedStep;

// ---------------------------------------------------------------- A. the five worlds
console.log('\nA. World boundaries');
check('five worlds of 2,000 m: 0-2000, 2000-4000, 4000-6000, 6000-8000, 8000-10000', W.WORLDS.length === 5 && W.WORLDS.every((w, i) => w.start === i * 2000 && w.end === (i + 1) * 2000) && W.JOURNEY_LENGTH === 10000);
check('worlds are in order, contiguous and never overlap', W.WORLDS.every((w, i) => i === 0 || w.start === W.WORLDS[i - 1].end) && W.WORLDS[0].start === 0 && W.WORLDS[4].end === 10000);
check('world order is Canyon, Frosty, Celestial, Palace, Sanctuary', W.WORLDS.map((w) => w.id).join() === 'canyon,arctic,celestial,palace,sanctuary');
{
  const edge = (d) => W.worldIndexAt(d);
  check('the world at every border: the last metre of a world and the first of the next', [[0, 0], [1999.99, 0], [2000, 1], [3999.99, 1], [4000, 2], [5999.99, 2], [6000, 3], [7999.99, 3], [8000, 4], [9999.99, 4], [10000, 4]].every(([d, i]) => edge(d) === i));
  check('negative and far distances stay inside the five worlds', edge(-5) === 0 && edge(1e9) === 4);
  let last = 0, crossings = 0, backwards = 0, skipped = 0;
  for (let d = 0; d <= 10000; d += 0.25) {
    const i = W.worldIndexAt(d);
    if (i < last) backwards++;
    if (i > last) { crossings++; if (i !== last + 1) skipped++; }
    last = i;
  }
  check('sweeping 0 to 10,000 m the world changes exactly 4 times, upwards, never skipping a world', crossings === 4 && backwards === 0 && skipped === 0);
}
check('the scenery zones take their borders from worlds.js (one source of truth)', ZONE_IDS.every((id, i) => BIOMES[id].start === W.WORLDS[i].start) && [0, 1, 2, 3].every((i) => BIOMES[ZONE_IDS[i]].end === W.WORLDS[i].end) && BIOMES.sanctuary.end === Infinity);
check('the obstacle kits and the hazards use the same borders', KIT_STARTS.every(([kit, start], i) => kit === W.WORLDS[i].kit && start === W.WORLDS[i].start) && [1999, 2000, 3999, 4000, 5999, 6000, 7999, 8000, 9999].every((d) => zoneAt(d)[0] === W.worldAt(d).kit && rockKit(d) === W.worldAt(d).kit && biomeAt(d).id === W.worldAt(d).id));
{
  // no leftover copy of an old border in the code that decides what a world is
  const files = ['src/systems/obstacles/rockShapes.js', 'src/systems/hazards/biomeHazards.js', 'src/systems/world/ambient.js'];
  const stale = files.filter((f) => /\b(1500|1665|1830|2330|2660|3660|4330)\b/.test(read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
  check('no old world border (1500, 1665, 1830, 2330, 2660, 3660, 4330) is left in the kit, hazard or ambient code', stale.length === 0, stale.join());
}

// ---------------------------------------------------------------- B. the difficulty curve
console.log('\nB. Difficulty and speed');
{
  let mono = true, maxStep = 0, prev = difficultyAt(0);
  for (let d = 1; d <= 10200; d++) { const t = difficultyAt(d); if (t < prev - 1e-12) mono = false; maxStep = Math.max(maxStep, t - prev); prev = t; }
  check('difficulty never falls and rises by at most 0.0002 per metre', mono && maxStep < 0.0002, maxStep.toFixed(6));
  check('it is 0 on the opening runway and 1 (the hardest the game has been) at the finish line', difficultyAt(0) === 0 && difficultyAt(40) === 0 && difficultyAt(10000) === 1 && difficultyAt(20000) === 1);
  const avg = W.WORLDS.map((w) => { let s = 0, n = 0; for (let d = w.start; d < w.end; d += 5) { s += difficultyAt(d); n++; } return s / n; });
  check('each world is harder than the one before (averages 0.1, 0.3, 0.5, 0.7, 0.9)', avg.every((a, i) => i === 0 || a > avg[i - 1] + 0.15) && avg.every((a, i) => Math.abs(a - (0.1 + 0.2 * i)) < 0.02), avg.map((a) => a.toFixed(2)).join(' '));
  const jumps = [2000, 4000, 6000, 8000].map((b) => Math.abs(difficultyAt(b + 1) - difficultyAt(b - 1)));
  check('no spike at 2,000, 4,000, 6,000 or 8,000 m: the same 0.0004 per 2 m as anywhere', jumps.every((j) => Math.abs(j - 2 / 9960) < 1e-9), jumps.map((j) => j.toFixed(5)).join(' '));
  let sMono = true, sMax = 0;
  for (let d = 1; d <= 10200; d++) { const a = speedAt(d - 1), b = speedAt(d); if (b < a - 1e-12) sMono = false; sMax = Math.max(sMax, b - a); }
  check('speed rises steadily from the base to the maximum with no jump, and is at the maximum from 6,000 m', sMono && sMax < 0.001 && speedAt(0) === WORLD.baseSpeed && speedAt(6000) === WORLD.maxSpeed && speedAt(10000) === WORLD.maxSpeed, `max step ${sMax.toFixed(5)} m/s per m`);
  check('the first world is gentle: at 2,000 m the pace is still well under the maximum', speedAt(2000) < WORLD.baseSpeed + (WORLD.maxSpeed - WORLD.baseSpeed) * 0.4);
  check('hardest tuning is no harder than before: gaps and spacing use the same range (only the climb is slower)', difficultyAt(1640) < 0.17 && difficultyAt(10000) === 1);
  check('the hard patterns arrive late: boulders after 250 m, wall formations after 600 m, the long tunnel after 1,000 m', UNLOCK.floatingRocks === 250 && UNLOCK.formation === 600 && UNLOCK.passage === 1000);
}

// ---------------------------------------------------------------- the simulation: milestones and the ending
/** A corridor-following bird (as in the collider tests): flies a seed to the end or its death. `onStep(sim)` sees every step. */
function fly(seed, onStep = () => {}, stopAt = Infinity) {
  const sim = createGameSim();
  sim.reset(seed);
  sim.flap();
  let steps = 0;
  while ((sim.phase === PHASE.RUNNING) && sim.distance < stopAt && steps++ < 120 * 1800) {
    const c = sim.track.corridors.find((k) => k.x1 > sim.distance - 0.3);
    const target = c ? Math.max(c.lo + 0.8, c.center - 0.6) : 0;
    const { y, vy } = sim.bird;
    if (vy < 0 && (y < target || (c && y < c.lo + 0.5))) sim.flap();
    sim.step(DT);
    onStep(sim);
  }
  return sim;
}
console.log('\nC. Milestones and the finish line');
{
  const log = [];
  const sims = [];
  for (const seed of [1, 2, 3, 4]) {
    const events = [];
    let lastDist = 0;
    let lastObstacleEnd = 0;
    const sim = fly(seed, (s) => {
      for (const e of s.events) if (e.type === GAME_EVENTS.MILESTONE || e.type === GAME_EVENTS.COMPLETE) events.push({ ...e, at: e.at ?? null, step: s.distance });
      s.events.length = 0;
      for (const o of s.obstacles.active) lastObstacleEnd = Math.max(lastObstacleEnd, o.x + o.extent);
      lastDist = s.distance;
    });
    sims.push({ sim, events, lastObstacleEnd });
    log.push(`${seed}: ${sim.phase} ${events.map((e) => e.type === GAME_EVENTS.COMPLETE ? 'C' : e.index).join('')}`);
  }
  check('a bird that survives completes the journey on every seed', sims.every(({ sim }) => sim.phase === PHASE.COMPLETE), log.join(' | '));
  check('each of the four milestones fires exactly once, in order, at its border', sims.every(({ events }) => { const m = events.filter((e) => e.type === GAME_EVENTS.MILESTONE); return m.length === 4 && m.every((e, i) => e.index === i && e.at === (i + 1) * 2000 && e.step >= e.at && e.step < e.at + 0.2 && e.world === W.WORLDS[i].id); }));
  check('the journey completes exactly once, after the four milestones, at 10,000 m', sims.every(({ events }) => events.filter((e) => e.type === GAME_EVENTS.COMPLETE).length === 1 && events[events.length - 1].type === GAME_EVENTS.COMPLETE && events[events.length - 1].distance === 10000 && events[events.length - 1].completed === true && events[events.length - 1].worlds === 5));
  check('the distance scored is exactly 10,000 m and the score is that plus the orbs', sims.every(({ sim }) => sim.metres === 10000 && sim.score === 10000 * 1 + sim.orbsCollected * 5));
  check(`no obstacle reaches within ${W.FINISH_CLEAR} m of the finish line (the last one ends at ${Math.max(...sims.map((s) => s.lastObstacleEnd)).toFixed(1)} m)`, sims.every((s) => s.lastObstacleEnd <= W.JOURNEY_LENGTH - W.FINISH_CLEAR + 1e-6));
  check('the track stops spawning at the end (finished flag set, no section beyond the line)', sims.every(({ sim }) => sim.track.finished === true && sim.track.corridors.every((c) => c.x1 <= W.JOURNEY_LENGTH - W.FINISH_CLEAR + 1e-6)));
}
{
  // after the finish: the glide. Nothing can hurt the bird, nothing is announced twice, input is ignored, no obstacle spawns.
  const sim = fly(7);
  const d0 = sim.distance;
  let evs = 0, bad = 0;
  sim.events.length = 0;
  sim.flap();
  sim.setDive(true);
  for (let i = 0; i < 120 * 12; i++) {
    sim.step(DT);
    evs += sim.events.length;
    sim.events.length = 0;
    if (sim.phase !== PHASE.COMPLETE || sim.bird.dead || !Number.isFinite(sim.bird.y) || sim.bird.y < WORLD.groundY + 0.3) bad++;
  }
  check('12 s after the finish the phase is still COMPLETE and the bird is untouchable (input ignored, no crash, no events)', bad === 0 && evs === 0);
  check('the world glides on past the line, slowly and smoothly, and the bird settles at a calm height', sim.distance > d0 + 20 && sim.speed < 4.5 && Math.abs(sim.bird.y - 1.2) < 0.05, `speed ${sim.speed.toFixed(2)}, y ${sim.bird.y.toFixed(2)}`);
  check('no obstacle exists ahead of the bird once the finish line is crossed', [...sim.obstacles.active].every((o) => o.x < sim.distance));
  sim.reset(7);
  check('a replay (reset) starts the journey afresh: READY, 0 m, no milestones, track unfinished', sim.phase === PHASE.READY && sim.distance === 0 && sim.milestonesDone === 0 && sim.completeTime === 0 && sim.track.finished === false && sim.events.length === 0);
}
{
  // collision and milestone / finish in the same step: the crash wins; nothing is announced or completed
  const probe = (at) => {
    const sim = createGameSim();
    sim.reset(3);
    sim.flap();
    sim.step(DT);
    sim.events.length = 0;
    sim.distance = sim.prevDistance = at - 0.001; // this very step crosses the border...
    sim.bird.y = WORLD.groundY + 0.2; // ...with the bird in the lava
    sim.bird.vy = -2;
    sim.step(DT);
    return sim;
  };
  const m = probe(2000);
  check('a crash in the step that crosses 2,000 m announces no milestone', m.phase === PHASE.DYING && !m.events.some((e) => e.type === GAME_EVENTS.MILESTONE) && m.milestonesDone === 0);
  const f = probe(10000);
  check('a crash in the step that crosses 10,000 m is a crash, never a completion', f.phase === PHASE.DYING && !f.events.some((e) => e.type === GAME_EVENTS.COMPLETE) && f.results().completed === false);
  // crossing alive: several borders in one step (a teleport) still announces each once and in order
  const sim = createGameSim();
  sim.reset(5);
  sim.flap();
  sim.step(DT);
  sim.events.length = 0;
  sim.distance = sim.prevDistance = 10000.5;
  sim.bird.y = 1;
  sim.step(DT);
  const kinds = sim.events.map((e) => (e.type === GAME_EVENTS.MILESTONE ? e.index : e.type));
  check('crossing all the borders in one step announces each once, in order, then completes once', kinds.join() === '0,1,2,3,complete' && sim.phase === PHASE.COMPLETE);
}

// ---------------------------------------------------------------- B (cont.): the generated tracks follow the curve
console.log('\nD. Generated tracks');
{
  const types = (seed) => { const out = []; const seen = new Set(); fly(seed, (s) => { for (const c of s.track.corridors) { const k = c.x0.toFixed(2); if (!seen.has(k)) { seen.add(k); out.push(c); } } }); return out; };
  const all = [1, 2, 3, 4, 5, 6].flatMap(types);
  const first = (t) => Math.min(...all.filter((c) => c.type === t).map((c) => c.x0));
  check(`patterns appear no earlier than their unlock (boulders ${first('floatingRocks').toFixed(0)}, formations ${first('formation').toFixed(0)}, tunnels ${first('passage').toFixed(0)} m)`, first('floatingRocks') > UNLOCK.floatingRocks && first('formation') > UNLOCK.formation && first('passage') > UNLOCK.passage);
  const perWorld = W.WORLDS.map((w) => all.filter((c) => c.x0 >= w.start && c.x0 < w.end));
  const gapAvg = perWorld.map((cs) => cs.reduce((s, c) => s + (c.hi - c.lo), 0) / cs.length);
  check('the guaranteed gap shrinks from world to world', gapAvg.every((g, i) => i === 0 || g < gapAvg[i - 1]), gapAvg.map((g) => g.toFixed(2)).join(' '));
  const sections = perWorld.map((cs) => cs.length);
  // (the last world has a few fewer sections than the fourth: the Cloud Sanctuary's low-gravity pockets reserve open runway, see runwayAfter)
  check('sections get more frequent from world to world (spacing shrinks) through the first four worlds; the last stays within 25% of the fourth', sections.slice(0, 4).every((n, i) => i === 0 || n >= sections[i - 1] * 0.97) && sections[4] >= sections[3] * 0.75, sections.join(' '));
  // reaction time: the open air between two sections, at that distance's speed
  let minReact = Infinity;
  for (const cs of [1, 2, 3, 4, 5, 6].map(types)) for (let i = 1; i < cs.length; i++) minReact = Math.min(minReact, (cs[i].x0 - cs[i - 1].x1) / speedAt(cs[i].x0));
  check(`the shortest open air between two sections is ${minReact.toFixed(2)} s at its speed (at least 0.55 s everywhere)`, minReact >= 0.55);
  // the hardest world is not harder than the old late game: the same gap range at the end as the old maximum
  const lastGap = Math.min(...perWorld[4].map((c) => c.hi - c.lo));
  check(`the smallest gap in the last world (${lastGap.toFixed(2)}) is what the old endless run held at full difficulty (about 2.9)`, lastGap >= 2.85);
}

// ---------------------------------------------------------------- E. rewards
console.log('\nE. Rewards');
check('five rewards with the five required names', R.REWARDS.map((r) => r.name).join('|') === 'Treasure Cache|Celestial City Orb|Celestial Bird Skin|Journey Champion Trophy|Celestial Feather');
check('the unlock schedule: Cache at World 1, Orb at World 2, Skin at World 4, Trophy and Feather at the finish line', R.REWARDS.map((r) => `${r.id}@${W.MILESTONES[r.milestone].at}`).join() === 'treasure-cache@2000,city-orb@4000,celestial-skin@8000,journey-trophy@10000,celestial-feather@10000');
check('the Celestial Feather is the primary, most prestigious reward (legendary, finish line only)', R.getReward('celestial-feather').primary && R.getReward('celestial-feather').rarity.rank === Math.max(...R.REWARDS.map((r) => r.rarity.rank)) && R.REWARDS.filter((r) => r.rarity.rank === 4).length === 1 && R.getReward('celestial-feather').milestone === 4);
{
  let j = R.sanitizeJourney(null);
  check('an empty save is a fresh journey', Object.keys(j.rewards).length === 0 && j.completions === 0 && j.milestones.join() === '0,0,0,0,0');
  const a = R.reachMilestone(j, 0, 3);
  check('reaching World 1 grants the Treasure Cache (and records the run)', a.granted.map((r) => r.id).join() === 'treasure-cache' && a.journey.rewards['treasure-cache'] === 3 && a.journey.milestones[0] === 1 && j.rewards['treasure-cache'] === undefined);
  const b = R.reachMilestone(a.journey, 0, 9);
  check('reaching it again grants nothing and keeps the original run number', b.granted.length === 0 && b.journey.rewards['treasure-cache'] === 3 && b.journey.milestones[0] === 2);
  const c = R.reachMilestone(b.journey, 2, 9);
  check('World 3 (6,000 m) has no reward of its own: a banner only', c.granted.length === 0);
  const f1 = R.reachMilestone(c.journey, 4, 9);
  check('the finish line grants the Trophy and the Feather and counts a completion', f1.granted.map((r) => r.id).join() === 'journey-trophy,celestial-feather' && f1.journey.completions === 1);
  const f2 = R.reachMilestone(f1.journey, 4, 10);
  check('flying the journey again counts the completion but grants nothing twice', f2.granted.length === 0 && f2.journey.completions === 2 && Object.keys(f2.journey.rewards).length === 3);
  check('invalid milestones are ignored', [-1, 5, 1.5, NaN, undefined].every((i) => R.reachMilestone(j, i, 1).granted.length === 0 && R.reachMilestone(j, i, 1).journey === j));
  const dirty = R.sanitizeJourney({ rewards: { 'celestial-feather': 4, hacked: 1, 'city-orb': 'x' }, completions: -3, milestones: [1, 'a', 2.7, null] });
  check('a corrupt or hand-edited save is cleaned: unknown rewards dropped, counts clamped, always a complete record', !('hacked' in dirty.rewards) && dirty.rewards['celestial-feather'] === 4 && dirty.rewards['city-orb'] === 1 && dirty.completions === 0 && dirty.milestones.length === 5 && dirty.milestones.every(Number.isInteger) && dirty.milestones[4] >= 1);
  check('garbage is an empty journey, never a throw', [undefined, 5, 'x', [], () => 1, { rewards: 7 }].every((g) => { try { return R.ownedCount(R.sanitizeJourney(g)) === 0; } catch { return false; } }));
}

// ---------------------------------------------------------------- F. the store: legitimate unlocks, once-only, persistence
console.log('\nF. Store');
{
  const { useGameStore, STATUS } = await import('../src/store/useGameStore.js');
  const st = () => useGameStore.getState();
  const res = (o = {}) => ({ score: 10100, distance: 10000, orbs: 20, bestStreak: 5, nearMisses: 3, cause: null, completed: true, worlds: 5, ...o });
  const startRun = () => { st().startGame(); st().beginRun(); };

  check('the collection screen opens and closes without granting anything', (() => { st().openRewards(); const open = st().rewardsOpen; st().closeRewards(); return open && !st().rewardsOpen && Object.keys(st().journey.rewards).length === 0 && disk.get('fireflipper:journey') === undefined; })());

  startRun();
  st().milestoneReached({ index: 0, at: 2000, name: 'Red Rock Canyon' });
  check('a survived World 1 border grants the Treasure Cache, saves it at once and raises the banner', st().journey.rewards['treasure-cache'] && JSON.parse(disk.get('fireflipper:journey')).rewards['treasure-cache'] && st().milestone?.index === 0 && st().milestone.granted.join() === 'treasure-cache');
  const j1 = st().journey;
  st().milestoneReached({ index: 0, at: 2000, name: 'Red Rock Canyon' });
  check('the same milestone twice in a run is ignored (no second banner, no second grant)', st().journey === j1);
  st().milestoneReached({ index: 3, at: 8000, name: 'Rose Sky Palace' });
  st().milestoneReached({ index: 1, at: 4000, name: 'Frosty Polar' });
  check('an out-of-order (late) milestone is ignored', st().journey.rewards['city-orb'] === undefined && st().journey.rewards['celestial-skin'] !== undefined);
  st().clearMilestone();
  check('the banner clears', st().milestone === null);

  // dying after a milestone keeps what was earned; no completion
  st().crash();
  st().milestoneReached({ index: 2, at: 6000, name: 'x' });
  check('a milestone event that arrives after the crash is ignored', st().journey.milestones[2] === 0);
  st().endRun({ score: 8100, distance: 8100, orbs: 5, cause: 'column', worlds: 4 });
  check('the crashed run ends once as OVER, with its rewards listed, and no completion', st().status === STATUS.OVER && st().lastResult.completed === false && st().lastResult.rewards.join() === 'treasure-cache,celestial-skin' && st().journey.completions === 0 && st().journey.rewards['celestial-feather'] === undefined);

  // refresh: a new store instance reads the same storage
  const again = await import('../src/store/useGameStore.js?refresh=1');
  check('rewards persist after a refresh (a fresh store loads them from storage)', again.useGameStore.getState().journey.rewards['treasure-cache'] && again.useGameStore.getState().journey.rewards['celestial-skin'] && !again.useGameStore.getState().journey.rewards['celestial-feather']);

  // replaying a completed milestone grants nothing twice
  st().restart();
  st().beginRun();
  st().milestoneReached({ index: 0, at: 2000, name: 'Red Rock Canyon' });
  check('replaying World 1 grants nothing again (banner shows, no rewards listed)', st().milestone.granted.length === 0 && st().runRewards.length === 0 && st().journey.milestones[0] === 2);

  // completion
  st().restart();
  st().beginRun();
  st().endRun(res());
  check('crossing the finish line ends the run as COMPLETE (not Game Over) and grants the Trophy and the Feather', st().status === STATUS.COMPLETE && st().lastResult.completed && st().lastResult.worlds === 5 && st().journey.rewards['journey-trophy'] && st().journey.rewards['celestial-feather'] && st().journey.completions === 1 && st().lastResult.rewards.join() === 'journey-trophy,celestial-feather');
  const stats = st().stats.runs;
  st().endRun(res());
  st().endRun({ ...res(), completed: false });
  st().crash();
  st().milestoneReached({ index: 1, at: 4000, name: 'x' });
  check('a completion cannot run twice or be overwritten (a late crash, a second completion, a stray milestone do nothing)', st().status === STATUS.COMPLETE && st().stats.runs === stats && st().journey.completions === 1);
  check('the completed run is saved: best score, stats and the journey record', st().bestScore === 10100 && JSON.parse(disk.get('fireflipper:journey')).completions === 1 && JSON.parse(disk.get('fireflipper:stats')).runs === stats);

  // a run that crashed can never complete
  st().restart();
  st().beginRun();
  st().crash();
  st().endRun(res());
  check('a completion reported for a run that already crashed is refused', st().status === STATUS.DYING && st().journey.completions === 1);
  st().endRun({ score: 5, distance: 5, orbs: 0, cause: 'lava', worlds: 0 });

  // replay resets the run but keeps the permanent record
  st().replayJourney();
  check('Replay Journey starts a fresh READY run and keeps every reward', st().status === STATUS.READY && st().distance === 0 && st().milestoneIndex === -1 && st().milestone === null && st().runRewards.length === 0 && st().lastResult === null && Object.keys(st().journey.rewards).length === 4);

  // Auto play (demo): nothing granted or saved
  const before = JSON.stringify(st().journey);
  st().startDemo();
  st().beginRun();
  st().milestoneReached({ index: 0, at: 2000, name: 'x' });
  st().endRun(res());
  check('Auto play never grants, counts or saves anything (it just ends and restarts)', JSON.stringify(st().journey) === before && st().status === STATUS.OVER && st().lastResult === null);

  // the Celestial skin is only usable once owned, and is a look only
  const fresh = await import('../src/store/useGameStore.js?fresh=1');
  disk.clear();
  const f = await import('../src/store/useGameStore.js?empty=1');
  f.useGameStore.getState().selectSkin('flipper-celestial');
  check('the Celestial skin cannot be selected before it is earned', f.useGameStore.getState().skinId !== 'flipper-celestial');
  void fresh;
}
{
  const celestial = getAvatar('flipper-celestial');
  check('the Celestial skin is a reward skin (not part of the 15-skin collection)', celestial.reward === 'celestial-skin' && AVATARS.length === 15 && !AVATARS.some((a) => a.id === 'flipper-celestial') && REWARD_AVATARS.length === 1);
  check('locked: it falls back to the bird in its free colour; owned: it is shown', resolveAvatar('flipper-celestial', 1e9, 'red', {}).id === 'bulbuli-fire' && resolveAvatar('flipper-celestial', 0, 'red', { 'celestial-skin': 1 }).id === 'flipper-celestial' && !isAvatarUnlocked(celestial, 1e9, 'red', {}) && isAvatarUnlocked(celestial, 0, 'red', { 'celestial-skin': 1 }));
  const simSrc = ['src/systems/game/createGameSim.js', 'src/systems/physics/flight.js', 'src/systems/physics/collision.js', 'src/systems/physics/constants.js', 'src/systems/obstacles/spawner.js', 'src/systems/scoring/scoring.js', 'src/systems/hazards/biomeHazards.js'].map(read).join('\n');
  check('rewards and skins cannot touch gameplay: the simulation, physics, collisions, scoring and hazards import no avatar, skin or reward code', !/avatars|skins\/|rewards\/|useGameStore/.test(simSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
  const ui = ['src/components/ui/RewardsPanel.jsx', 'src/components/ui/JourneyEnding.jsx', 'src/components/ui/MilestoneToast.jsx'].map(read).join('\n');
  check('the reward screens only display: none of them grants a reward', !/reachMilestone|milestoneReached|endRun/.test(ui));
}

// ---------------------------------------------------------------- G. the ending screens
console.log('\nG. Screens');
{
  const ending = read('src/components/ui/JourneyEnding.jsx');
  check('the celebration skips only after a guard, by button, Enter or Escape (the final seconds of tapping cannot skip it)', /SKIP_GUARD_MS/.test(ending) && /armed\.current/.test(ending) && /'Escape'/.test(ending));
  check('every timer and listener of the ending is cleaned up', /clearTimeout\(arm\)/.test(ending) && /clearTimeout\(done\)/.test(ending) && /removeEventListener\('keydown'/.test(ending) && /clearTimeout\(late\)/.test(ending));
  check('the final screen has the required words and actions', /Journey Complete/.test(ending) && /reached the Celestial City!/.test(ending) && /Replay Journey/.test(ending) && /View Rewards/.test(ending) && /Return to Main Menu/.test(ending) && /Celestial Feather unlocked/.test(ending));
  check('the final screen shows distance, score, orbs, worlds completed and rewards unlocked', ['Final distance', 'Final score', 'Orbs collected', 'Worlds completed', 'Rewards unlocked'].every((t) => ending.includes(t)));
  const css = read('src/styles/journey.css');
  check('only opacity and transform are animated (no layout animation, no per-frame JavaScript)', !/animation:[^;]*\b(width|height|top|left)\b/.test(css) && !/requestAnimationFrame|setInterval/.test(ending));
  check('reduced motion is respected', /prefers-reduced-motion/.test(css) && /prefers-reduced-motion/.test(ending));
  const toast = read('src/components/ui/MilestoneToast.jsx');
  check('the milestone banner ignores the pointer, removes itself and cleans its timer', /pointer-events: none/.test(css) && /clearTimeout\(id\)/.test(toast) && /TOAST_MS/.test(toast));
  const screen = read('src/components/game/GameScreen.jsx');
  check('the ending is mounted by the COMPLETE status only (once), for real play and the Journey Preview, never for plain Auto play', /status === STATUS\.COMPLETE && \(!demo \|\| preview\)/.test(screen) && /\(!demo \|\| preview\) && \(status === STATUS\.RUNNING/.test(screen));
  const loop = read('src/systems/game/useGameLoop.js');
  check('the loop forwards milestones and the finish line from the simulation to the store', /routeSimEvent/.test(loop) && /MILESTONE\) store\.milestoneReached/.test(read('src/systems/game/routeEvents.js')) && /COMPLETE\) store\.endRun/.test(read('src/systems/game/routeEvents.js')));
}

console.log(failures ? `\n${failures} failed` : '\njourney tests passed');
process.exit(failures ? 1 : 0);
