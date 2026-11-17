/**
 * Headless gameplay tests. Run with: npm run test:sim
 * Exercises the pure simulation (no browser, no WebGL).
 */
import { createGameSim, PHASE } from '../src/systems/game/createGameSim.js';
import {
  circleIntersectsBox,
  circleIntersectsCircle,
  circleHitsObstacle,
} from '../src/systems/physics/collision.js';
import { clearanceToObstacle } from '../src/systems/physics/collision.js';
import { PHYSICS, WORLD, SCORING, POWERUPS } from '../src/systems/physics/constants.js';
import { seedForKey, todayKey } from '../src/utils/daily.js';
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
  check(
    'crashed at the obstacle face',
    sim.distance > 3 - 0.5 - PHYSICS.birdRadius - 0.2 && sim.distance < 3,
  );
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

// ---------------------------------------------------------------- near misses
section('Near misses');
{
  check(
    'clearance: box side',
    Math.abs(clearanceToObstacle(0, 0, 0.5, { shape: 'box', x: 2, y: 0, hw: 1, hh: 5 }) - 0.5) < 1e-9,
  );
  check(
    'clearance: circle',
    Math.abs(clearanceToObstacle(0, 0, 0.5, { shape: 'circle', x: 3, y: 0, cr: 1 }) - 1.5) < 1e-9,
  );
  check(
    'clearance: negative when overlapping',
    clearanceToObstacle(0, 0, 0.5, { shape: 'box', x: 0.5, y: 0, hw: 1, hh: 1 }) < 0,
  );

  // Hold the bird at a fixed height by pinning y each step (isolates the near-miss logic).
  const pinned = (offset, rocks = 1, spacing = 2, steps = 400) => {
    const sim = createGameSim();
    sim.reset(21);
    sim.obstacles.releaseAll();
    sim.orbs.releaseAll();
    sim.track.nextX = 1e9;
    sim.flap();
    sim.step(DT);
    for (let k = 0; k < rocks; k++) {
      const o = sim.obstacles.acquire();
      Object.assign(o, {
        kind: 'rock',
        shape: 'circle',
        x: 3 + k * spacing,
        y: 0 + offset,
        r: 0.5,
        cr: 0.43,
        extent: 0.5,
        gap: Infinity,
        passed: false,
      });
    }
    const y = 0;
    for (let i = 0; i < steps && sim.phase === PHASE.RUNNING; i++) {
      sim.bird.y = sim.bird.prevY = y;
      sim.bird.vy = 0;
      sim.step(DT);
    }
    return sim;
  };

  const close = pinned(PHYSICS.birdRadius + 0.43 + 0.1);
  check('close pass still alive', close.phase === PHASE.RUNNING);
  check('close pass counts a near miss', close.nearMisses === 1, `got ${close.nearMisses}`);
  check('near miss bonus', close.bonus === SCORING.nearMissPoints);
  check('near miss event once', countEvents(close, 'nearMiss') === 1);
  check('near miss adds to score', close.score === close.metres + SCORING.nearMissPoints);

  const wide = pinned(PHYSICS.birdRadius + 0.43 + 1.5);
  check('wide pass is not a near miss', wide.nearMisses === 0 && wide.bonus === 0);

  const streak = pinned(PHYSICS.birdRadius + 0.43 + 0.1, 3);
  check('three close passes', streak.nearMisses === 3, `got ${streak.nearMisses}`);
  check(
    'streak multiplies bonus',
    streak.bonus === SCORING.nearMissPoints * (1 + 2 + 3),
    `bonus ${streak.bonus}`,
  );

  const slow = pinned(PHYSICS.birdRadius + 0.43 + 0.1, 2, 60, 1800);
  check(
    'streak resets after the window',
    slow.streak === 1 && slow.bonus === SCORING.nearMissPoints * 2,
    `streak ${slow.streak} bonus ${slow.bonus}`,
  );

  const crashed = createGameSim();
  crashed.reset(22);
  crashed.obstacles.releaseAll();
  crashed.track.nextX = 1e9;
  crashed.flap();
  for (let i = 0; i < 600 && crashed.phase === PHASE.RUNNING; i++) crashed.step(DT);
  check('no near-miss events when nothing was passed', crashed.nearMisses === 0);
}

// ---------------------------------------------------------------- power-ups
section('Power-ups');
{
  const fresh = (seed = 31) => {
    const sim = createGameSim();
    sim.reset(seed);
    sim.obstacles.releaseAll();
    sim.orbs.releaseAll();
    sim.powerups.releaseAll();
    sim.track.nextX = 1e9;
    return sim;
  };
  const grab = (sim, type) => {
    const p = sim.powerups.acquire();
    Object.assign(p, { type, x: 1, y: sim.bird.y, phase: 0 });
  };
  const wall = (sim, x) => {
    const o = sim.obstacles.acquire();
    Object.assign(o, {
      kind: 'block',
      shape: 'box',
      x,
      y: WORLD.birdStartY,
      hw: 0.5,
      hh: 6,
      extent: 0.5,
      gap: Infinity,
      passed: false,
    });
  };
  const run = (sim, steps) => {
    for (let i = 0; i < steps && sim.phase === PHASE.RUNNING; i++) {
      sim.bird.y = sim.bird.prevY = WORLD.birdStartY;
      sim.bird.vy = 0;
      sim.step(DT);
    }
  };

  const s1 = fresh();
  s1.flap();
  grab(s1, 'shield');
  run(s1, 60);
  check('shield picked up', s1.power.shield === true);
  check('powerup event once', countEvents(s1, 'powerup') === 1);
  check('pickup leaves the pool', s1.powerups.active.size === 0);

  wall(s1, s1.distance + 3);
  run(s1, 200);
  check('shield absorbs a crash', s1.phase === PHASE.RUNNING, `phase ${s1.phase}`);
  check('shield is consumed', s1.power.shield === false);
  check('shield break event once', countEvents(s1, 'shieldBreak') === 1);
  check('shielded hit is not a near miss', s1.nearMisses === 0);

  wall(s1, s1.distance + 3);
  run(s1, 200);
  check('without shield the next wall kills', s1.phase !== PHASE.RUNNING);

  const s2 = fresh();
  s2.flap();
  grab(s2, 'magnet');
  run(s2, 60);
  check('magnet active', s2.power.magnet > 0 && s2.power.magnet <= POWERUPS.magnetDuration);
  const orb = s2.orbs.acquire();
  Object.assign(orb, { x: s2.distance + 3, y: WORLD.birdStartY + 2.5, phase: 0 });
  run(s2, 120);
  check('magnet draws in an orb the bird never touches', s2.orbsCollected === 1);
  run(s2, POWERUPS.magnetDuration * 120);
  check('magnet expires', s2.power.magnet === 0);

  const s3 = fresh();
  s3.flap();
  run(s3, 5);
  const before = s3.speed;
  grab(s3, 'slow');
  run(s3, 60);
  check('slow-mo reduces speed', s3.speed < before * POWERUPS.slowFactor + 0.2, `${s3.speed} vs ${before}`);

  s3.reset(1);
  check('reset clears power-ups', !s3.power.shield && s3.power.magnet === 0 && s3.power.slow === 0);

  // Power-ups spawn on real tracks, never before minDistance, and only reachable-height.
  let spawned = 0;
  let early = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const sim = createGameSim();
    sim.reset(seed);
    sim.flap();
    for (let i = 0; i < 120 * 40; i++) {
      for (const p of sim.powerups.active) {
        spawned++;
        if (p.x < POWERUPS.minDistance) early++;
        if (p.y < WORLD.groundY || p.y > WORLD.ceilingY) early++;
      }
      sim.bird.y = sim.bird.prevY = WORLD.birdStartY;
      sim.bird.vy = 0;
      sim.step(DT);
      if (sim.phase !== PHASE.RUNNING) break;
    }
  }
  check('power-ups spawn on generated tracks', spawned > 0);
  check('power-ups respect min distance and stay in the flight band', early === 0, `${early} violations`);
}

// ---------------------------------------------------------------- daily challenge
section('Daily challenge');
{
  check('date key format', /^\d{4}-\d{2}-\d{2}$/.test(todayKey()));
  check('key is UTC', todayKey(new Date('2026-11-17T23:59:00Z')) === '2026-11-17');
  check('same day, same seed', seedForKey('2026-11-17') === seedForKey('2026-11-17'));
  check('different days, different seeds', seedForKey('2026-11-17') !== seedForKey('2026-11-18'));

  const layout = (seed) => {
    const sim = createGameSim();
    sim.reset(seed);
    return [...sim.obstacles.active].map((o) => `${o.kind}:${o.x.toFixed(3)}:${o.y.toFixed(3)}`).join('|');
  };
  const a = layout(seedForKey('2026-11-17'));
  check('track has obstacles', a.length > 0);
  check('same seed gives an identical track', a === layout(seedForKey('2026-11-17')));
  check('different seeds give different tracks', a !== layout(seedForKey('2026-11-18')));
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
  check(
    'reset clears state',
    sim.phase === PHASE.READY && sim.distance === 0 && sim.orbsCollected === 0 && sim.events.length === 0,
  );
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
      crashes.push(
        `seed ${seed} @ ${sim.metres}m (${c?.type}, y=${sim.bird.y.toFixed(2)}, corridor ${c?.lo.toFixed(2)}..${c?.hi.toFixed(2)})`,
      );
    }
  }
  console.log(
    `  autopilot survived ${survived}/${SEEDS} runs to ${TARGET} m (avg ${(totalOrbs / SEEDS).toFixed(0)} orbs)`,
  );
  crashes.forEach((c) => console.log(`    crash: ${c}`));
  check('every generated track navigable', survived === SEEDS);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
