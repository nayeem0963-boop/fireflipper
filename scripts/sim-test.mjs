/**
 * Headless gameplay tests. Run with: npm run test:sim
 * Exercises the pure simulation (no browser, no WebGL).
 */
import { createGameSim, PHASE } from '../src/systems/game/createGameSim.js';
import { circleIntersectsBox, circleIntersectsCircle, circleHitsObstacle } from '../src/systems/physics/collision.js';
import { PHYSICS, WORLD, SCORING } from '../src/systems/physics/constants.js';
import { computeScore } from '../src/systems/scoring/scoring.js';

const DT = PHYSICS.fixedStep;
let failures = 0;
let passes = 0;
function check(name, cond, detail = '') {
  if (cond) passes++;
  else {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
}
const section = (s) => console.log(`\n${s}`);
const countEvents = (sim, type) => sim.events.filter((e) => e.type === type).length;

// ---------------------------------------------------------------- collision
section('Collision primitives');
check('circle overlaps box edge', circleIntersectsBox(0, 0, 0.5, 0.9, 0, 0.5, 1));
check('circle misses box', !circleIntersectsBox(0, 0, 0.5, 1.1, 0, 0.5, 1));
check('circle misses box corner diagonally', !circleIntersectsBox(0, 0, 0.5, 0.9, 0.9, 0.5, 0.5));
check('circle hits box corner', circleIntersectsBox(0, 0, 0.5, 0.8, 0.8, 0.5, 0.5));
check('circles overlap', circleIntersectsCircle(0, 0, 1, 1.5, 0, 0.6));
check('circles apart', !circleIntersectsCircle(0, 0, 1, 1.7, 0, 0.6));
check('dispatch box', circleHitsObstacle(0, 0, 0.4, { shape: 'box', x: 0.5, y: 0, hw: 0.2, hh: 1 }));
check('dispatch circle', !circleHitsObstacle(0, 0, 0.4, { shape: 'circle', x: 2, y: 0, cr: 1 }));

// ---------------------------------------------------------------- scoring
section('Scoring');
check('score formula', computeScore(100, 3) === 100 * SCORING.pointsPerMetre + 3 * SCORING.orbPoints);

// ---------------------------------------------------------------- flight
section('Flight physics');
{
  const sim = createGameSim();
  sim.reset(5);
  for (let i = 0; i < 60; i++) sim.step(DT);
  check('ready: world does not move', sim.distance === 0);
  check('ready: bird hovers', Math.abs(sim.bird.y - WORLD.birdStartY) < 0.2);
  sim.flap();
  sim.step(DT);
  check('first flap starts run', sim.phase === PHASE.RUNNING);
  check('flap gives upward velocity', sim.bird.vy > 7);
  check('start event emitted once', countEvents(sim, 'start') === 1);

  // Frame-rate independence: same input, different step sizes, similar result.
  const a = createGameSim();
  const b = createGameSim();
  a.reset(9);
  b.reset(9);
  a.flap();
  b.flap();
  for (let i = 0; i < 120; i++) a.step(1 / 120);
  for (let i = 0; i < 240; i++) b.step(1 / 240);
  check('frame-rate independent height', Math.abs(a.bird.y - b.bird.y) < 0.05, `${a.bird.y} vs ${b.bird.y}`);
  check('frame-rate independent distance', Math.abs(a.distance - b.distance) < 0.05);

  // Holding gives a higher climb than tapping; diving falls faster.
  const peak = (hold) => {
    const s = createGameSim();
    s.reset(3);
    s.setHolding(hold);
    s.flap();
    let max = -Infinity;
    for (let i = 0; i < 90; i++) {
      s.step(DT);
      max = Math.max(max, s.bird.y);
    }
    return max;
  };
  check('hold climbs higher than tap', peak(true) > peak(false) + 0.3);
  const fall = (dive) => {
    const s = createGameSim();
    s.reset(3);
    s.flap();
    s.step(DT);
    s.setDive(dive);
    for (let i = 0; i < 40; i++) s.step(DT);
    return s.bird.vy;
  };
  check('dive falls faster', fall(true) < fall(false) - 3);
}

// ---------------------------------------------------------------- run stats
section('Run stats');
{
  const sim = createGameSim();
  sim.reset(21);
  sim.obstacles.releaseAll();
  sim.orbs.releaseAll();
  sim.track.nextX = 1e9;
  // Column whose edge the bird (flying level) skims past, then a lava death.
  const o = sim.obstacles.acquire();
  Object.assign(o, { kind: 'column', shape: 'box', x: 4, y: 12, hw: 0.4, hh: 10, extent: 0.5, gap: Infinity, nm: false });
  sim.flap();
  for (let i = 0; i < 120 * 5 && sim.phase === PHASE.RUNNING; i++) {
    sim.bird.y = 1.5; // 0.14 clearance under the column's lower edge
    sim.bird.vy = 0;
    sim.step(DT);
    if (sim.distance > 8) break;
  }
  check('near miss counted once', sim.nearMisses === 1, `got ${sim.nearMisses}`);
  while (sim.phase === PHASE.RUNNING) sim.step(DT);
  check('lava cause recorded', sim.results().cause === 'lava');
  const r = sim.results();
  check('results carry stats', 'bestStreak' in r && 'nearMisses' in r && 'cause' in r);
}
{
  const sim = createGameSim();
  sim.reset(22);
  sim.obstacles.releaseAll();
  sim.orbs.releaseAll();
  sim.track.nextX = 1e9;
  const y = sim.bird.y;
  for (const x of [3, 5]) Object.assign(sim.orbs.acquire(), { x, y, phase: 0, missed: false });
  Object.assign(sim.orbs.acquire(), { x: 7, y: 20, phase: 0, missed: false }); // unreachable: breaks the streak
  for (const x of [9]) Object.assign(sim.orbs.acquire(), { x, y, phase: 0, missed: false });
  sim.flap();
  for (let i = 0; i < 120 * 3 && sim.distance < 11; i++) {
    sim.bird.y = y;
    sim.bird.vy = 0;
    sim.step(DT);
  }
  check('best streak tracks consecutive orbs', sim.bestStreak === 2 && sim.orbStreak === 1, `${sim.bestStreak}/${sim.orbStreak}`);
}
{
  const sim = createGameSim();
  sim.reset(23);
  sim.obstacles.releaseAll();
  sim.track.nextX = 1e9;
  const o = sim.obstacles.acquire();
  Object.assign(o, { kind: 'rock', shape: 'circle', x: 3, y: 0.4, cr: 1, extent: 1, gap: Infinity, nm: false });
  sim.flap();
  for (let i = 0; i < 120 * 3 && sim.phase === PHASE.RUNNING; i++) {
    sim.bird.y = 0.4;
    sim.bird.vy = 0;
    sim.step(DT);
  }
  check('obstacle cause recorded', sim.crashCause === 'rock', String(sim.crashCause));
}

// ---------------------------------------------------------------- crash
section('Crash & game over');
{
  const sim = createGameSim();
  sim.reset(11);
  sim.flap();
  for (let i = 0; i < 120 * 4 && sim.phase === PHASE.RUNNING; i++) sim.step(DT); // no input → falls into lava
  check('falling into lava crashes', sim.phase === PHASE.DYING);
  const distanceAtCrash = sim.metres;
  const scoreAtCrash = sim.score;
  for (let i = 0; i < 120 * 3; i++) sim.step(DT);
  check('reaches game over', sim.phase === PHASE.OVER);
  check('crash event exactly once', countEvents(sim, 'crash') === 1);
  check('over event exactly once', countEvents(sim, 'over') === 1);
  check('score frozen after crash', sim.score === scoreAtCrash && sim.metres === distanceAtCrash);
  sim.flap();
  sim.step(DT);
  check('flap after game over does nothing', sim.phase === PHASE.OVER && countEvents(sim, 'flap') === 1);
}
{
  // Fly straight into an obstacle placed in front of the bird.
  const sim = createGameSim();
  sim.reset(12);
  sim.obstacles.releaseAll();
  sim.track.nextX = 1e9; // stop generation
  const o = sim.obstacles.acquire();
  Object.assign(o, { kind: 'column', shape: 'box', x: 3, y: 0.4, hw: 0.5, hh: 3, extent: 0.75 });
  sim.flap();
  let crashed = false;
  for (let i = 0; i < 120 && !crashed; i++) {
    if (sim.bird.vy < 0) sim.flap();
    sim.step(DT);
    crashed = sim.phase === PHASE.DYING;
  }
  check('hits obstacle in path', crashed);
  check('crashed at the obstacle face', sim.distance > 3 - 0.5 - PHYSICS.birdRadius - 0.2 && sim.distance < 3);
}

// ---------------------------------------------------------------- orbs
section('Orbs');
{
  const sim = createGameSim();
  sim.reset(13);
  sim.obstacles.releaseAll();
  sim.orbs.releaseAll();
  sim.track.nextX = 1e9;
  const orb = sim.orbs.acquire();
  orb.x = 1;
  orb.y = WORLD.birdStartY + 0.6;
  sim.flap();
  for (let i = 0; i < 60; i++) sim.step(DT);
  check('orb collected', sim.orbsCollected === 1);
  check('orb event once', countEvents(sim, 'orb') === 1);
  check('orb removed from pool', sim.orbs.active.size === 0);
  check('orb adds bonus', sim.score === sim.metres + SCORING.orbPoints);
}

// ---------------------------------------------------------------- restarts / pooling
section('Repeated restarts & pooling');
{
  const sim = createGameSim();
  let maxObstacles = 0;
  let maxOrbs = 0;
  for (let run = 0; run < 200; run++) {
    sim.reset(run + 100);
    sim.flap();
    for (let i = 0; i < 400; i++) {
      if (sim.bird.y < 0 && sim.bird.vy < 0) sim.flap();
      sim.step(DT);
    }
    maxObstacles = Math.max(maxObstacles, sim.obstacles.size);
    maxOrbs = Math.max(maxOrbs, sim.orbs.size);
  }
  check('obstacle pool bounded', maxObstacles < 120, `size ${maxObstacles}`);
  check('orb pool bounded', maxOrbs < 80, `size ${maxOrbs}`);
  sim.reset(1);
  check('reset clears state', sim.phase === PHASE.READY && sim.distance === 0 && sim.orbsCollected === 0 && sim.events.length === 0);
  console.log(`  peak pool sizes: obstacles ${maxObstacles}, orbs ${maxOrbs}`);
}

// ---------------------------------------------------------------- fairness
section('Fairness: autopilot over generated tracks');
{
  // A simple controller that only sees corridors (as a player would) and flaps
  // to stay near the upcoming corridor centre. If generation ever produced an
  // impossible arrangement, it would crash.
  const TARGET = 3000;
  const SEEDS = 40;
  let survived = 0;
  let totalOrbs = 0;
  const crashes = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const sim = createGameSim();
    sim.reset(seed);
    sim.flap();
    let steps = 0;
    while (sim.phase === PHASE.RUNNING && sim.distance < TARGET) {
      const bx = sim.distance;
      const c = sim.track.corridors.find((k) => k.x1 > bx - 0.3);
      // A flap from a standstill peaks ~1.3 higher, so aim a little below centre.
      const target = c ? Math.max(c.lo + 0.8, c.center - 0.6) : 0;
      // Flap only while falling, when we're about to sink below the target.
      const { y, vy } = sim.bird;
      const nearFloor = c && y < c.lo + 0.5;
      if (vy < 0 && (y < target || nearFloor)) sim.flap();
      sim.step(DT);
      steps++;
      if (steps > 120 * 600) break;
    }
    totalOrbs += sim.orbsCollected;
    if (sim.distance >= TARGET) survived++;
    else {
      const c = sim.track.corridors.find((k) => k.x1 > sim.scoredDistance - 0.3);
      crashes.push(`seed ${seed} @ ${sim.metres}m (${c?.type}, y=${sim.bird.y.toFixed(2)}, corridor ${c?.lo.toFixed(2)}..${c?.hi.toFixed(2)})`);
    }
  }
  console.log(`  autopilot survived ${survived}/${SEEDS} runs to ${TARGET} m (avg ${(totalOrbs / SEEDS).toFixed(0)} orbs)`);
  crashes.forEach((c) => console.log(`    crash: ${c}`));
  check('every generated track navigable', survived === SEEDS);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
