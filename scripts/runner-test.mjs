/**
 * Ground-runner (v2) tests. Run with: npm run test:runner
 * Covers the runner's movement (jump height, hop, coyote time, jump buffer, landing), its colliders (obstacles and pits), that every section
 * the generator builds is clearable by construction (the analytic jump limits), the Auto play bot over many seeds to the finish line, that the
 * simulation presents the same interface the loop, HUD and scene read, its events, and that progress is kept apart per game version.
 */
import { readFileSync, readdirSync } from 'node:fs';

// A tiny in-memory localStorage, installed before the store loads, so saved progress can be checked across version switches.
const mem = new Map();
globalThis.window = {
  location: { search: '' },
  localStorage: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) },
};

const { createRunnerSim } = await import('../src/systems/runner/createRunnerSim.js');
const { createRunnerAutopilot } = await import('../src/systems/runner/autopilot.js');
const { RUN, airTimeAbove, FULL_JUMP_TIME } = await import('../src/systems/runner/constants.js');
const { pressJump, stepRunner } = await import('../src/systems/runner/physics.js');
const { fitsOneJump, minSpacing } = await import('../src/systems/runner/track.js');
const { PHYSICS, WORLD } = await import('../src/systems/physics/constants.js');
const { speedAt } = await import('../src/systems/physics/speed.js');
const { difficultyAt } = await import('../src/systems/obstacles/spawner.js');
const { JOURNEY_LENGTH, FINISH_CLEAR, WORLD_COUNT } = await import('../src/systems/world/worlds.js');
const { GAME_EVENTS } = await import('../src/systems/events/gameEvents.js');
const { computeScore } = await import('../src/systems/scoring/scoring.js');
const { PREVIEW_SEEDS } = await import('../src/systems/rewards/preview.js');
const { createGameSim } = await import('../src/systems/game/createGameSim.js');

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
};
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const DT = PHYSICS.fixedStep;

// ---- movement: a bare bird on flat land
const fresh = () => ({ y: RUN.groundY, vy: 0, grounded: true, sinceGround: 0, buffer: 0, sinceFlap: 99 });
function jumpProfile(holdFor) {
  const b = fresh();
  const input = { holding: true, dive: false };
  pressJump(b);
  let apex = 0;
  let t = 0;
  let held = 0;
  do {
    input.holding = held < holdFor;
    held += DT;
    stepRunner(b, input, DT, true);
    apex = Math.max(apex, b.y - RUN.groundY);
    t += DT;
  } while (!b.grounded && t < 5);
  return { apex, t, b };
}
const full = jumpProfile(Infinity);
const hop = jumpProfile(0);
check('a held jump reaches its full height (about 2.0)', Math.abs(full.apex - (RUN.jumpSpeed ** 2) / (2 * -RUN.gravity)) < 0.05, full.apex.toFixed(3));
check('a held jump lasts what the analytic jump says', Math.abs(full.t - FULL_JUMP_TIME) < 0.03, `${full.t.toFixed(3)} vs ${FULL_JUMP_TIME.toFixed(3)}`);
check('a tap is a hop: lower than a full jump, but still over 1.1', hop.apex < full.apex - 0.4 && hop.apex > 1.1, hop.apex.toFixed(3));
check('she lands back on the land and stands', full.b.grounded && full.b.y === RUN.groundY && full.b.vy === 0);
{
  const b = fresh();
  pressJump(b);
  stepRunner(b, { holding: true, dive: false }, DT, true);
  const vy = b.vy;
  pressJump(b);
  stepRunner(b, { holding: true, dive: false }, DT, true);
  check('there is no double jump (a press in mid-air does not lift her again)', b.vy < vy, `${b.vy} vs ${vy}`);
}
{
  // jump buffer: a press just before landing jumps on touchdown
  const b = fresh();
  b.y = RUN.groundY + 0.15;
  b.vy = -3;
  b.grounded = false;
  b.sinceGround = 0.3;
  pressJump(b);
  let jumped = false;
  for (let i = 0; i < 40 && !jumped; i++) jumped = stepRunner(b, { holding: true, dive: false }, DT, true);
  check('a jump pressed just before landing happens on landing (the jump buffer)', jumped);
  // a press too early is forgotten
  const c = fresh();
  c.y = RUN.groundY + 3;
  c.vy = -5;
  c.grounded = false;
  c.sinceGround = 0.6;
  pressJump(c);
  let jumpedEarly = false;
  for (let i = 0; i < 240 && !c.grounded; i++) jumpedEarly = stepRunner(c, { holding: true, dive: false }, DT, true) || jumpedEarly;
  check('a press far too early is forgotten', !jumpedEarly);
}
{
  // coyote time: a jump just after running off an edge works; much later it does not
  const b = fresh();
  stepRunner(b, { holding: false, dive: false }, DT, false); // the land gives way
  pressJump(b);
  check('a jump just after running off an edge still works (coyote time)', stepRunner(b, { holding: true, dive: false }, DT, false));
  const c = fresh();
  for (let i = 0; i < 30; i++) stepRunner(c, { holding: false, dive: false }, DT, false);
  pressJump(c);
  check('but not long after', !stepRunner(c, { holding: true, dive: false }, DT, false));
}
{
  const a = fresh();
  const b = fresh();
  pressJump(a);
  pressJump(b);
  let ta = 0;
  let tb = 0;
  for (let t = 0; t < 3; t += DT) {
    stepRunner(a, { holding: true, dive: false }, DT, true);
    stepRunner(b, { holding: true, dive: t > 0.45 }, DT, true);
    if (!a.grounded) ta = t;
    if (!b.grounded) tb = t;
  }
  check('Down drops her faster', tb < ta - 0.05, `${tb.toFixed(2)} vs ${ta.toFixed(2)}`);
}

// ---- the simulation: start, collisions, pits, events
function sim(seed = 1) {
  const s = createRunnerSim();
  s.reset(seed);
  return s;
}
const stepN = (s, n) => {
  for (let i = 0; i < n && (s.phase === 'running' || s.phase === 'ready'); i++) s.step(DT);
};
{
  const s = sim(3);
  check('the run starts waiting on the land, idle', s.phase === 'ready' && s.bird.grounded && s.bird.y === RUN.groundY && s.bird.idle);
  s.step(DT);
  check('nothing moves before the first press', s.distance === 0);
  s.flap();
  check('the first press starts the run', s.phase === 'running' && !s.bird.idle && s.events[0].type === GAME_EVENTS.START);
  s.step(DT);
  check('and she jumps (the jump is the flap event)', s.events.some((e) => e.type === GAME_EVENTS.FLAP) && !s.bird.grounded);
}
{
  // standing still on a rock's path kills her; the cause names it
  const s = sim(3);
  s.flap();
  let guard = 0;
  while (s.phase === 'running' && guard++ < 120 * 20) s.step(DT);
  check('running into an obstacle ends the run', s.phase === 'dying' && ['rock', 'ice', 'log', 'pit'].includes(s.crashCause), s.crashCause);
  for (let i = 0; i < 120 * 3; i++) s.step(DT);
  check('then the game-over event comes after the stumble', s.phase === 'over' && s.events.some((e) => e.type === GAME_EVENTS.CRASH) && s.events.some((e) => e.type === GAME_EVENTS.OVER));
  check('the score is frozen where she fell', s.metres === Math.floor(s.scoredDistance) && s.score === computeScore(s.metres, s.orbsCollected));
}
{
  // a pit: the land gives way, but only beyond its forgiving lips
  const s = sim(5);
  s.obstacles.releaseAll();
  s.orbs.releaseAll();
  s.track.nextX = 1e9; // no more sections
  const pit = s.obstacles.acquire();
  Object.assign(pit, { kind: 'pit', look: 'pit', shape: 'none', x: 30, x0: 28, x1: 32, w: 4, extent: 2, y: RUN.groundY, h: 0, nm: true, gap: Infinity });
  s.flap();
  stepN(s, 2);
  s.input.flapQueued = false;
  let guard = 0;
  while (s.phase === 'running' && guard++ < 120 * 20) s.step(DT); // she never jumps again: she runs into the pit
  check('running into a pit drops her: she falls to her death in it', s.crashCause === 'pit' && s.bird.y < RUN.groundY, `${s.crashCause} ${s.bird.y}`);
  check('the land is there up to the pit lip and beyond the far lip', s.landAt(27.9) && s.landAt(28 + RUN.pitLip - 0.01) && !s.landAt(30) && s.landAt(32 - RUN.pitLip + 0.01));
}
{
  // a jump over a rock clears it; her head is above the colliders, so only her legs and torso matter
  const s = sim(5);
  s.obstacles.releaseAll();
  s.orbs.releaseAll();
  s.track.nextX = 1e9;
  const o = s.obstacles.acquire();
  Object.assign(o, { kind: 'rock', look: 'rock', shape: 'box', x: 24, y: RUN.groundY + 0.4, w: 1.2, h: 0.8, hw: 0.55, hh: 0.36, x0: 23.4, x1: 24.6, extent: 0.6, nm: false, gap: Infinity });
  s.flap(); // jump at the start: far too early to clear it
  s.input.holding = true;
  let guard = 0;
  while (s.phase === 'running' && s.distance < 26 && guard++ < 120 * 20) {
    // jump again 0.35 s before the rock (a hold-jump takeoff centred on it)
    if (s.bird.grounded && (24 - 0.6 - s.distance) / s.speed < 0.45) s.flap();
    s.step(DT);
  }
  check('a well-timed held jump clears a rock', s.phase === 'running' && s.distance >= 26, `${s.phase} ${s.crashCause} ${s.distance.toFixed(1)}`);
}

// ---- the interface the loop, the HUD, the events and the scene read (it must match the flying simulation's)
{
  const r = createRunnerSim();
  const f = createGameSim();
  const flat = (o, prefix = '') => Object.keys(o).flatMap((k) => (o[k] && typeof o[k] === 'object' && !(o[k] instanceof Set) && k !== 'events' && k !== 'obstacles' && k !== 'orbs' && k !== 'items' && k !== 'track' && k !== 'hazard' ? flat(o[k], `${prefix}${k}.`) : [`${prefix}${k}`]));
  const missing = ['phase', 'seed', 'time', 'distance', 'prevDistance', 'speed', 'orbsCollected', 'orbStreak', 'bestStreak', 'nearMisses', 'crashCause', 'magnetLeft', 'shield', 'shieldLeft', 'grace', 'alpha', 'events', 'obstacles', 'orbs', 'items', 'track', 'fx', 'input', 'bird', 'metres', 'score', 'completed', 'results', 'reset', 'flap', 'setHolding', 'setDive', 'step', 'renderDistance', 'renderBirdY'].filter((k) => !(k in r));
  check('the runner exposes what the loop, the HUD and the scene read', missing.length === 0, missing.join());
  const birdMissing = Object.keys(f.bird).filter((k) => !(k in r.bird));
  check('its bird has every field the flying bird has (so the avatar layer and the trail work)', birdMissing.length === 0, birdMissing.join());
  void flat;
  check('and tells the loop which bot it needs', r.kind === 'runner' && f.kind === undefined);
  check('its results have the same shape as the flying game\'s (so the store takes them as they are)', Object.keys(r.results()).sort().join() === Object.keys(f.results()).sort().join());
  check('the runner has no power-ups (the pool is there and empty)', r.items.active.size === 0 && r.shield === false && r.magnetLeft === 0);
}

// ---- every generated section is clearable by construction, on many tracks
const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);
{
  let sections = 0;
  let pits = 0;
  let violations = [];
  let spacingViolations = 0;
  let tooCloseToFinish = 0;
  const BODY = 2 * RUN.hitCircles[0].r;
  for (const seed of SEEDS) {
    const s = createRunnerSim();
    s.reset(seed);
    // run the generator to the end by moving the sim along (fillRunnerTrack runs as the distance grows)
    const all = [];
    const seen = new Set();
    for (let d = 0; d < JOURNEY_LENGTH + 60; d += 20) {
      s.distance = s.prevDistance = d;
      s.phase = 'running';
      s.step(1e-6);
      for (const o of s.obstacles.active) if (!seen.has(o.x + ':' + o.kind)) {
        seen.add(o.x + ':' + o.kind);
        all.push({ kind: o.kind, x0: o.x0, x1: o.x1, w: o.w, h: o.h });
      }
      // keep the sim alive whatever it ran into on the way (this test only reads what was built)
      s.phase = 'running';
      s.bird.dead = false;
      s.crashCause = null;
    }
    all.sort((a, b) => a.x0 - b.x0);
    // group into sections: obstacles within 1.7 m of each other are one cluster (a pair)
    const clusters = [];
    for (const o of all) {
      const last = clusters[clusters.length - 1];
      if (last && o.x0 - last.x1 < 1.7) {
        last.x1 = Math.max(last.x1, o.x1);
        last.h = Math.max(last.h, o.h);
        last.items.push(o);
      } else clusters.push({ x0: o.x0, x1: o.x1, h: o.h, items: [o] });
    }
    clusters.forEach((c, i) => {
      sections++;
      const v = speedAt(c.x0);
      const d = difficultyAt(c.x0);
      const isPit = c.items.some((o) => o.kind === 'pit');
      if (isPit) {
        pits++;
        const open = c.x1 - c.x0 - 2 * RUN.pitLip;
        if (open + BODY > 0.85 * v * FULL_JUMP_TIME) violations.push(`pit@${c.x0.toFixed(0)} open ${open.toFixed(2)} v ${v.toFixed(2)}`);
      } else if (!fitsOneJump(c.x1 - c.x0, c.h, v)) violations.push(`section@${c.x0.toFixed(0)} span ${(c.x1 - c.x0).toFixed(2)} h ${c.h.toFixed(2)} v ${v.toFixed(2)}`);
      if (c.h > 1.0 + 1e-9 && !isPit) violations.push(`tall@${c.x0.toFixed(0)} h ${c.h}`);
      const next = clusters[i + 1];
      if (next && next.x0 - c.x1 < minSpacing(speedAt(c.x1), difficultyAt(c.x1)) - 1e-6) spacingViolations++;
      if (c.x1 > JOURNEY_LENGTH - FINISH_CLEAR) tooCloseToFinish++;
    });
  }
  check(`every section on ${SEEDS.length} full tracks fits inside one full jump (${sections} sections, ${pits} pits)`, violations.length === 0, violations.slice(0, 3).join(' | '));
  check('there is always room to land, react and jump between sections', spacingViolations === 0, String(spacingViolations));
  check('nothing is built in the last stretch before the finish line', tooCloseToFinish === 0, String(tooCloseToFinish));
  check('the tracks actually contain pits and obstacles to jump', pits > 20 && sections > 1500, `${pits} ${sections}`);
}
{
  const a = sim(9);
  const b = sim(9);
  const list = (s) => [...s.obstacles.active].map((o) => `${o.kind}${o.x.toFixed(2)}`).join();
  check('the same seed builds the same track', list(a) === list(b) && list(a).length > 0);
  check('a different seed builds a different one', list(a) !== list(sim(10)));
  check('the first obstacle comes after the opening runway', Math.min(...[...a.obstacles.active].map((o) => o.x0)) >= WORLD.runway);
}

// ---- Auto play: the bot reaches the finish line on every seed we try (the Journey Preview seeds included)
function botRun(seed, maxMetres = JOURNEY_LENGTH) {
  const s = createRunnerSim();
  s.reset(seed);
  const bot = createRunnerAutopilot(s);
  bot.reset();
  let guard = 0;
  while (s.phase !== 'over' && s.phase !== 'complete' && s.distance < maxMetres + 5 && guard++ < 120 * 3000) {
    bot.control();
    s.step(DT);
  }
  return { s, bot };
}
{
  const bad = [];
  let fallbacks = 0;
  let near = 0;
  let orbs = 0;
  const seeds = [...new Set([...PREVIEW_SEEDS, ...SEEDS.slice(0, 10)])];
  for (const seed of seeds) {
    const { s, bot } = botRun(seed);
    fallbacks += bot.stats.fallbacks;
    near += s.nearMisses;
    orbs += s.orbsCollected;
    if (s.phase !== 'complete') bad.push(`${seed}:${s.phase}@${s.distance.toFixed(0)}(${s.crashCause})`);
  }
  check(`Auto play reaches the finish line on all ${seeds.length} seeds (the preview seeds included)`, bad.length === 0, bad.join(' '));
  check('and never has to jump with no safe plan', fallbacks === 0, String(fallbacks));
  check('it collects orbs and has close calls, so it plays rather than coasts', orbs > seeds.length * 2000 && near > 0, `${orbs} orbs, ${near} near`);
}
{
  const { s } = botRun(2);
  const ev = [];
  s.events.length = 0;
  check('finishing the journey completes the run with all five worlds', s.phase === 'complete' && s.results().worlds === WORLD_COUNT && s.results().completed && s.scoredDistance === JOURNEY_LENGTH);
  // milestones: four, once each, in order (a fresh run, watching events)
  const t = createRunnerSim();
  t.reset(2);
  const bot = createRunnerAutopilot(t);
  bot.reset();
  const milestones = [];
  let complete = 0;
  let guard = 0;
  while (t.phase !== 'complete' && t.phase !== 'over' && guard++ < 120 * 3000) {
    bot.control();
    t.step(DT);
    for (const e of t.events) {
      if (e.type === GAME_EVENTS.MILESTONE) milestones.push(e.index);
      if (e.type === GAME_EVENTS.COMPLETE) complete++;
    }
    t.events.length = 0;
  }
  void ev;
  check('four milestones fire once each, in order, then the finish', milestones.join() === '0,1,2,3' && complete === 1, `${milestones.join()} ${complete}`);
  const d0 = t.distance;
  for (let i = 0; i < 240; i++) t.step(DT);
  check('after the finish she jogs on safely: nothing hurts her and the distance still grows', t.phase === 'complete' && t.distance > d0 && t.bird.grounded);
}

// ---- the runner never looks at an avatar, a skin or a version
{
  const dir = 'src/systems/runner';
  const files = readdirSync(new URL(`../${dir}`, import.meta.url)).filter((f) => f.endsWith('.js'));
  const src = strip(files.map((f) => read(`${dir}/${f}`)).join('\n'));
  check('the runner simulation imports no avatar, skin, version or store code', !/avatars|skins\/|versions|useGameStore|playerConfig/.test(src), `${files.length} files`);
}

// ---- progress is kept apart per version
{
  const { useGameStore, SCREENS } = await import('../src/store/useGameStore.js?runner-progress');
  const st = () => useGameStore.getState();
  const finish = (score) => {
    st().startGame();
    st().beginRun();
    st().crash();
    st().endRun({ score, distance: Math.floor(score / 2), orbs: 3, bestStreak: 2, nearMisses: 1, cause: 'rock', completed: false, worlds: 0 });
    st().exitToMenu();
  };
  check('the store starts in v1', st().versionId === 'v1' && st().screen === SCREENS.HOME);
  finish(400);
  check('a v1 run sets the v1 best score and is saved under the original key', st().bestScore === 400 && mem.get('fireflipper:bestScore') === '400');
  st().selectVersion('v2');
  check('switching to v2 shows an empty record: its own best score, stats and achievements', st().bestScore === 0 && st().stats.runs === 0 && Object.keys(st().earned).length === 0);
  finish(900);
  check('a v2 run sets the v2 best score and is saved under its own key', st().bestScore === 900 && mem.get('fireflipper:v2:bestScore') === '900' && mem.get('fireflipper:bestScore') === '400');
  check('a v2 run counts no bird as flown and unlocks no bird skin', Object.keys(st().flown).length === 0 && !mem.has('fireflipper:v2:flown') && !(st().lastResult?.unlockedSkins ?? []).length);
  st().selectVersion('v1');
  check('back in v1 its record is exactly as it was', st().bestScore === 400 && st().stats.runs === 1);
  st().selectVersion('v2');
  check('and v2 kept its own', st().bestScore === 900 && st().stats.runs === 1);
  st().selectVersion('v1');
  check('the session best starts again when the version changes', st().sessionBest === 0);
  // Auto play still saves nothing in either version
  st().selectVersion('v2');
  const before = [...mem.entries()].join();
  st().startDemo();
  st().beginRun();
  st().crash();
  st().endRun({ score: 5000, distance: 2500, orbs: 9, completed: false });
  st().exitToMenu();
  check('Auto play saves nothing in v2', [...mem.entries()].join() === before && st().bestScore === 900);
}

console.log(failures ? `${failures} failed` : 'runner tests passed');
process.exit(failures ? 1 : 0);
