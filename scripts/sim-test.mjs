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
import { PHYSICS, WORLD, SCORING, POWERUPS, WIND } from '../src/systems/physics/constants.js';
import { seedForKey, todayKey } from '../src/utils/daily.js';
import { SKINS, getSkin, isUnlocked, resolveSkin, newlyUnlocked } from '../src/systems/skins/skins.js';
import { BIOME_SHIFT, biomeBlendAt, biomeIdAt } from '../src/systems/biomes/biomes.js';
import { DYN, GEYSER, geyserState, rockfallState, swingEdge } from '../src/systems/obstacles/dynamics.js';
import { PATTERNS } from '../src/systems/obstacles/patterns.js';
import { createRng } from '../src/utils/random.js';
import { applyFlap, stepFlight } from '../src/systems/physics/flight.js';
import { escalationAt, speedAt } from '../src/systems/obstacles/spawner.js';
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

// ---------------------------------------------------------------- skins
section('Skins');
{
  check('default skin is always unlocked', isUnlocked(SKINS[0], 0));
  check('skin ids are unique', new Set(SKINS.map((k) => k.id)).size === SKINS.length);
  check(
    'thresholds ascend',
    SKINS.every((k, i) => i === 0 || k.unlockScore > SKINS[i - 1].unlockScore),
  );
  const second = SKINS[1];
  check('locked below threshold', !isUnlocked(second, second.unlockScore - 1));
  check('unlocked at threshold', isUnlocked(second, second.unlockScore));
  check('unknown id falls back to default', getSkin('nope') === SKINS[0]);
  check('locked selection resolves to default', resolveSkin(second.id, 0) === SKINS[0]);
  check('unlocked selection resolves to itself', resolveSkin(second.id, second.unlockScore) === second);
  check(
    'nothing unlocked without crossing a threshold',
    newlyUnlocked(0, second.unlockScore - 1).length === 0,
  );
  check('crossing a threshold unlocks that skin', newlyUnlocked(0, second.unlockScore)[0] === second);
  check(
    'already-held skins are not re-announced',
    newlyUnlocked(second.unlockScore, second.unlockScore + 1).length === 0,
  );
  check('a big jump unlocks several', newlyUnlocked(0, 1e9).length === SKINS.length - 1);
}

// ---------------------------------------------------------------- biomes
section('Biomes');
{
  check('starts fully Ember Valley', biomeBlendAt(0) === 0 && biomeIdAt(0) === 'ember');
  check('no change before the shift range', biomeBlendAt(BIOME_SHIFT.start) === 0);
  check(
    'fully Obsidian Reach after the range',
    biomeBlendAt(BIOME_SHIFT.end) === 1 && biomeIdAt(1e6) === 'obsidian',
  );
  const mid = (BIOME_SHIFT.start + BIOME_SHIFT.end) / 2;
  check('blend is half way at the midpoint', Math.abs(biomeBlendAt(mid) - 0.5) < 1e-9);
  let monotonic = true;
  for (let d = 0; d < 1000; d += 5) if (biomeBlendAt(d + 5) < biomeBlendAt(d)) monotonic = false;
  check('blend never goes backwards', monotonic);
}

// ---------------------------------------------------------------- track rhythm
section('Track rhythm and escalation');
{
  // Autopilot a number of tracks, recording what the generator produced.
  let breathers = 0;
  let breathersWithHazards = 0;
  let breathersWithOrbs = 0;
  let maxHazardRun = 0;
  const kinds = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const sim = createGameSim();
    sim.reset(seed);
    sim.flap();
    const seenBreathers = new Set();
    let run = 0;
    let lastType = null;
    for (let i = 0; i < 120 * 200 && sim.phase === PHASE.RUNNING && sim.distance < 1200; i++) {
      const c = sim.track.corridors.find((k) => k.x1 > sim.distance - 0.3);
      const target = c ? Math.max(c.lo + 0.8, c.center - 0.6) : 0;
      if (sim.bird.vy < 0 && (sim.bird.y < target || (c && sim.bird.y < c.lo + 0.5))) sim.flap();
      sim.step(DT);
      for (const k of sim.track.corridors) {
        if (k.type !== lastType && k.x0 > 0 && !seenBreathers.has(k)) {
          seenBreathers.add(k);
          if (k.type === 'breather') {
            breathers++;
            run = 0;
            const inside = [...sim.obstacles.active].filter(
              (o) => o.x + o.extent > k.x0 + 0.6 && o.x - o.extent < k.x1,
            );
            if (inside.length) breathersWithHazards++;
            if ([...sim.orbs.active].some((o) => o.x >= k.x0 && o.x <= k.x1)) breathersWithOrbs++;
          } else {
            run++;
            maxHazardRun = Math.max(maxHazardRun, run);
          }
        }
      }
      for (const o of sim.obstacles.active)
        kinds.add(o.dyn ? (o.dyn === DYN.SWING ? 'swing' : 'geyser') : o.kind);
    }
  }
  check('breathers appear on generated tracks', breathers >= 12, `${breathers}`);
  // (A rock formation can overhang the end of its own section by a fraction of a unit, so ignore the first 0.6.)
  check('breathers contain no hazards', breathersWithHazards === 0, `${breathersWithHazards} had hazards`);
  check('breathers offer orbs', breathersWithOrbs >= breathers * 0.9, `${breathersWithOrbs}/${breathers}`);
  check('hazard stretches stay bounded (relief is regular)', maxHazardRun <= 8, `longest ${maxHazardRun}`);
  check('swinging gates appear', kinds.has('swing'));
  check('geysers appear', kinds.has('geyser'));

  check('escalation is zero before the late game', escalationAt(1000) === 0 && escalationAt(1640) === 0);
  check('escalation keeps rising after the main ramp', escalationAt(2500) > 0.3 && escalationAt(4100) === 1);
  check(
    'speed keeps rising after the main ramp',
    speedAt(3000) > WORLD.maxSpeed && speedAt(1500) === WORLD.maxSpeed,
  );
}

// ---------------------------------------------------------------- moving hazards
section('Moving hazards');
{
  const swing = (over = {}) => ({
    dyn: DYN.SWING,
    side: -1,
    edge0: 1,
    amp: 0.7,
    freq: 0.35,
    offset: 0.4,
    farY: -4.7,
    ...over,
  });

  // A swinging gate: both edges move together, so the opening keeps its height.
  const lower = swing({ side: -1, edge0: 1 - 1.5, farY: -4.7 });
  const upper = swing({ side: 1, edge0: 1 + 1.5, farY: 14 });
  let minOpen = Infinity;
  let maxOpen = -Infinity;
  let laneLo = -Infinity;
  let laneHi = Infinity;
  for (let t = 0; t < 12; t += 0.01) {
    const lo = swingEdge(lower, t);
    const hi = swingEdge(upper, t);
    minOpen = Math.min(minOpen, hi - lo);
    maxOpen = Math.max(maxOpen, hi - lo);
    laneLo = Math.max(laneLo, lo);
    laneHi = Math.min(laneHi, hi);
  }
  check('the opening keeps a constant height', maxOpen - minOpen < 1e-9);
  check('a lane stays open at every moment', laneHi - laneLo > 3 - 2 * 0.7 - 0.01, `${laneHi - laneLo}`);
  check(
    'the lane matches the generator guarantee',
    Math.abs(laneLo - (1 - 1.5 + 0.7)) < 0.01 && Math.abs(laneHi - (1 + 1.5 - 0.7)) < 0.01,
  );

  // Geyser cycle.
  const g = { period: 3.4, offset: 0, maxH: 4 };
  let liveBeforeTelegraphEnds = false;
  let sawLive = false;
  let maxH = 0;
  for (let t = 0; t < g.period * 3; t += 0.005) {
    const st = geyserState(g, t);
    const u = t % g.period;
    if (u < GEYSER.telegraph && st.live) liveBeforeTelegraphEnds = true;
    if (st.live) sawLive = true;
    maxH = Math.max(maxH, st.h);
  }
  check('a geyser always telegraphs before it can hurt', !liveBeforeTelegraphEnds);
  check('a geyser does erupt', sawLive);
  check('a geyser never exceeds its height', maxH <= g.maxH + 1e-9);
  check(
    'a geyser is quiet for part of every cycle',
    !geyserState(g, g.period - 0.2).live && !geyserState(g, 0.2).live,
  );
  check('the glow rises through the telegraph', geyserState(g, 0.7).glow > geyserState(g, 0.05).glow);
  check('the cycle repeats', geyserState(g, 1.3).h === geyserState(g, 1.3 + g.period).h);

  // In the simulation: erupting geysers kill, quiet ones do not, and the run clock only starts on the first flap.
  const arrival = 4 / WORLD.baseSpeed;
  const flyThrough = (offset) => {
    const sim = createGameSim();
    sim.reset(41);
    sim.obstacles.releaseAll();
    sim.orbs.releaseAll();
    sim.powerups.releaseAll();
    sim.track.nextX = 1e9;
    sim.flap();
    const o = sim.obstacles.acquire();
    Object.assign(o, {
      kind: 'geyser',
      shape: 'box',
      x: 4,
      z: 0,
      w: 1.4,
      d: 1.4,
      hw: 0.56,
      extent: 0.7,
      rot: 0,
      cap: 0,
      dyn: DYN.GEYSER,
      maxH: 4,
      period: 3.4,
      offset,
      live: true,
      glow: 0,
      gap: Infinity,
      passed: false,
    });
    for (let i = 0; i < 400 && sim.phase === PHASE.RUNNING; i++) {
      sim.bird.y = sim.bird.prevY = -1.6; // low enough to be inside an eruption, above the lava
      sim.bird.vy = 0;
      sim.step(DT);
      if (sim.distance > 7) break;
    }
    return sim;
  };
  const erupting = flyThrough(GEYSER.telegraph + 0.4 - arrival);
  check(
    'flying into an erupting geyser is fatal',
    erupting.phase !== PHASE.RUNNING && erupting.death?.kind === 'geyser',
    `${erupting.phase} ${erupting.death?.kind}`,
  );
  const resting = flyThrough(GEYSER.telegraph + GEYSER.erupt + GEYSER.retract + 0.3 - arrival);
  check(
    'a quiet geyser can be flown past',
    resting.phase === PHASE.RUNNING && resting.distance > 6,
    `${resting.phase}`,
  );
  const charging = flyThrough(0.1 - arrival);
  check(
    'a charging geyser is harmless',
    charging.phase === PHASE.RUNNING && charging.distance > 6,
    `${charging.phase}`,
  );

  const clock = createGameSim();
  clock.reset(5);
  for (let i = 0; i < 120; i++) clock.step(DT);
  check('the run clock waits for the first flap', clock.runTime === 0);
  clock.flap();
  for (let i = 0; i < 120; i++) clock.step(DT);
  check('...then counts run time', Math.abs(clock.runTime - 1) < 1e-6, `${clock.runTime}`);
}

// ---------------------------------------------------------------- falling rocks
section('Falling rocks');
{
  const R = PHYSICS.birdRadius;
  // Run the real pattern against a recording builder, then rebuild the rock record the way the sim does.
  const build = (center, gap, seed = 1) => {
    const calls = { rockfall: null, column: 0 };
    const builder = {
      rockfall: (...a) => (calls.rockfall = a),
      column: () => calls.column++,
      orb: () => {},
    };
    const rng = createRng(seed);
    const section = PATTERNS.rockfall(builder, 100, center, gap, rng);
    if (!calls.rockfall) return { calls, section };
    const [x, r, y0, drop, trigger] = calls.rockfall;
    const rock = { dyn: DYN.ROCKFALL, x, r, cr: r * 0.86, y0, drop, trigger };
    return { calls, section, rock };
  };

  let combos = 0;
  let hits = 0;
  let neverHung = 0;
  let fallbacks = 0;
  for (let c = -1.6; c <= 3.6; c += 0.25) {
    for (let gap = 2.5; gap <= 4.6; gap += 0.3) {
      for (let seed = 1; seed <= 3; seed++) {
        const { calls, section, rock } = build(c, gap, seed);
        if (!rock) {
          fallbacks++;
          if (calls.column !== 1) hits++; // the fallback must still place something
          continue;
        }
        combos++;
        const laneTop = c + gap / 2;
        check;
        // Every height in the guaranteed lane, crossing the whole width of the rock.
        for (let h = WORLD.groundY + 0.4; h <= laneTop + 1e-9; h += 0.1) {
          for (let d = rock.x - (rock.cr + R + 1.5); d <= rock.x + (rock.cr + R + 1.5); d += 0.02) {
            const st = rockfallState(rock, d);
            if (st.live && Math.hypot(rock.x - d, st.y - h) < rock.cr + R) hits++;
          }
        }
        // Before the trigger it hangs clear above anywhere the bird can be.
        if (rockfallState(rock, rock.x - rock.trigger - 1).y - rock.cr <= WORLD.ceilingY + R) neverHung++;
        if (section.hi !== laneTop) hits++;
      }
    }
  }
  check('rockfall patterns were generated across the range', combos > 100, `${combos}`);
  check('the lane below a falling rock is never hit', hits === 0, `${hits} hits`);
  check('a rock hangs clear above the ceiling until it is triggered', neverHung === 0, `${neverHung}`);
  check('high corridors fall back to a plain column', fallbacks > 0);

  const { rock } = build(0, 3.4);
  const before = rockfallState(rock, rock.x - rock.trigger - 3);
  const atTrigger = rockfallState(rock, rock.x - rock.trigger);
  const mid = rockfallState(rock, rock.x - rock.trigger / 2);
  const at = rockfallState(rock, rock.x);
  const after = rockfallState(rock, rock.x + 5);
  check(
    "not lethal while hanging, and out of the bird's reach at the trigger",
    !before.live && atTrigger.y - rock.cr > WORLD.ceilingY + PHYSICS.birdRadius,
  );
  check('lethal once falling', mid.live && at.live);
  check(
    'it is falling toward the bird',
    atTrigger.y > mid.y && mid.y > at.y,
    `${atTrigger.y} ${mid.y} ${at.y}`,
  );
  check(
    'it speeds up as it falls',
    mid.y - at.y > atTrigger.y - mid.y,
    `${mid.y - at.y} vs ${atTrigger.y - mid.y}`,
  );
  check('it keeps falling after the bird passes', rockfallState(rock, rock.x + 2).y < at.y);
  check('it lands and shatters on the ground', after.landed && !after.live && after.y < WORLD.groundY + 1);
  check(
    '...within a few units behind where the bird crossed it',
    !rockfallState(rock, rock.x + 2).landed && rockfallState(rock, rock.x + 6).landed,
  );
  check('the shattered rock fades away', rockfallState(rock, rock.x + 14).fade === 0 && after.fade <= 1);

  // In the simulation: the lane is safe (even in slow-mo), the blocked band is deadly, and landing fires one event.
  const fly = ({ height, slow = false }) => {
    const { rock: spec, section } = build(0, 3.4, 7);
    const sim = createGameSim();
    sim.reset(51);
    sim.obstacles.releaseAll();
    sim.orbs.releaseAll();
    sim.powerups.releaseAll();
    sim.winds.releaseAll();
    sim.track.nextX = 1e9;
    sim.flap();
    sim.step(DT);
    if (slow) sim.power.slow = 30;
    const o = sim.obstacles.acquire();
    Object.assign(o, {
      kind: 'rock',
      shape: 'circle',
      z: 0,
      sx: 1,
      sy: 1,
      sz: 1,
      rot: 0,
      spin: 0,
      cap: 0,
      extent: spec.r,
      live: true,
      gap: Infinity,
      passed: false,
      landed: false,
      announced: false,
      fade: 1,
      ...spec,
      x: 40,
    });
    let impacts = 0;
    for (let i = 0; i < 120 * 40 && sim.phase === PHASE.RUNNING && sim.distance < 60; i++) {
      sim.bird.y = sim.bird.prevY = height ?? section.hi - 0.3;
      sim.bird.vy = 0;
      sim.step(DT);
      impacts += sim.events.filter((e) => e.type === 'rockImpact').length;
      sim.events.length = 0;
    }
    return { sim, impacts };
  };
  const lane = fly({});
  check(
    'flying the lane under a falling rock is safe',
    lane.sim.phase === PHASE.RUNNING && lane.sim.distance >= 59,
    `${lane.sim.phase} ${lane.sim.distance}`,
  );
  check('the landing fires exactly one impact event', lane.impacts === 1, `${lane.impacts}`);
  const slowLane = fly({ slow: true });
  check(
    'the lane stays safe in slow-mo',
    slowLane.sim.phase === PHASE.RUNNING && slowLane.sim.distance >= 59,
  );
  const band = fly({ height: 3.7 });
  check(
    'flying into the falling rock is fatal',
    band.sim.phase !== PHASE.RUNNING && band.sim.death?.kind === 'rock',
    `${band.sim.phase} ${band.sim.death?.kind}`,
  );
}

// ---------------------------------------------------------------- air currents
section('Air currents');
{
  const fresh = () => ({ y: 0, vy: 0, pitch: 0, sinceFlap: 99 });
  const input = { holding: false, dive: false };
  const run = (wind, seconds, start = fresh()) => {
    const b = start;
    for (let i = 0; i < seconds / DT; i++) {
      stepFlight(b, input, DT, wind);
      b.y = Math.max(-100, Math.min(b.y, WORLD.ceilingY));
    }
    return b;
  };

  const calm = run(0, 0.5);
  const up = run(WIND.updraft, 0.5);
  const down = run(WIND.downdraft, 0.5);
  check('an updraft slows the fall', up.vy > calm.vy, `${up.vy} vs ${calm.vy}`);
  check('a downdraft speeds the fall', down.vy < calm.vy, `${down.vy} vs ${calm.vy}`);
  check('an updraft carries the bird upward', run(WIND.updraft, 2).y > 0 || run(WIND.updraft, 2).vy > 0);
  check('an updraft is capped', run(WIND.updraft, 3).vy <= WIND.liftCap + 1e-9, `${run(WIND.updraft, 3).vy}`);
  check(
    'the downdraft still has a terminal speed',
    run(WIND.downdraft, 4).vy >= WIND.fallCap - 1e-9,
    `${run(WIND.downdraft, 4).vy}`,
  );
  check(
    'a flap is never cut by the lift cap',
    (() => {
      const b = fresh();
      applyFlap(b);
      const v = b.vy;
      stepFlight(b, input, DT, WIND.updraft);
      return b.vy > WIND.liftCap && b.vy <= v + 1e-9 + WIND.updraft * DT;
    })(),
  );
  check(
    'no wind leaves flight unchanged',
    (() => {
      const a = fresh();
      const b = fresh();
      for (let i = 0; i < 100; i++) {
        stepFlight(a, input, DT);
        stepFlight(b, input, DT, 0);
      }
      return a.vy === b.vy && a.y === b.y;
    })(),
  );

  // In the simulation: the zone only acts inside its x-range, and expired zones are dropped.
  const sim = createGameSim();
  sim.reset(61);
  sim.obstacles.releaseAll();
  sim.orbs.releaseAll();
  sim.powerups.releaseAll();
  sim.track.nextX = 1e9;
  sim.flap();
  const zone = sim.winds.acquire();
  Object.assign(zone, { x0: 10, x1: 16, accel: WIND.updraft });
  const heightAt = (distanceLimit) => {
    sim.bird.y = sim.bird.prevY = 0.5;
    sim.bird.vy = 0;
    while (sim.distance < distanceLimit && sim.phase === PHASE.RUNNING) {
      sim.bird.y = Math.max(sim.bird.y, -2);
      sim.step(DT);
    }
    return sim.bird.vy;
  };
  const vyBefore = heightAt(9.5);
  check('the bird falls normally before the zone', vyBefore < 0, `${vyBefore}`);
  sim.bird.vy = -3;
  const inside = heightAt(14);
  check('inside the zone the fall is arrested', inside > -3, `${inside}`);
  heightAt(60);
  check('a zone far behind is dropped', sim.winds.active.size === 0, `${sim.winds.active.size}`);

  // On generated tracks, zones appear only in breathers and only after the minimum distance.
  const zones = [];
  const breathers = [];
  for (let seed = 1; seed <= 25; seed++) {
    const s2 = createGameSim();
    s2.reset(seed);
    s2.flap();
    const seen = new Set();
    for (let i = 0; i < 120 * 300 && s2.phase === PHASE.RUNNING && s2.distance < 1500; i++) {
      const c = s2.track.corridors.find((k) => k.x1 > s2.distance - 0.3);
      const target = c ? Math.max(c.lo + 0.8, c.center - 0.6) : 0;
      if (s2.bird.vy < 0 && (s2.bird.y < target || (c && s2.bird.y < c.lo + 0.5))) s2.flap();
      s2.step(DT);
      if (i % 30 === 0) {
        for (const k of s2.track.corridors)
          if (k.type === 'breather' && !seen.has(k)) (seen.add(k), breathers.push(k));
        for (const w of s2.winds.active) if (!seen.has(w)) (seen.add(w), zones.push({ ...w, seed }));
      }
    }
  }
  check('air currents appear on generated tracks', zones.length >= 5, `${zones.length}`);
  check(
    'both updrafts and downdrafts appear',
    zones.some((w) => w.accel > 0) && zones.some((w) => w.accel < 0),
  );
  check(
    'zones only occur inside breathers',
    zones.every((w) => breathers.some((k) => w.x0 >= k.x0 && w.x1 <= k.x1)),
    `${zones.filter((w) => !breathers.some((k) => w.x0 >= k.x0 && w.x1 <= k.x1)).length} outside`,
  );
  check(
    'none before the minimum distance',
    zones.every((w) => w.x0 > 180),
  );
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
