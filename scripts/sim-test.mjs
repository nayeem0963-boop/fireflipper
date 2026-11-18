/**
 * Headless gameplay tests. Run with: npm run test:sim
 * Exercises the pure simulation (no browser, no WebGL).
 */
import { createGameSim, PHASE } from '../src/systems/game/createGameSim.js';
import { circleIntersectsBox, circleIntersectsCircle, circleHitsObstacle, clearanceToObstacle } from '../src/systems/physics/collision.js';
import { createStepper } from '../src/systems/game/fixedStep.js';
import { createRng } from '../src/utils/random.js';
import { CELLS, MOVING_MARGIN, SIGHT_DISTANCE, cellOf, cellY, createPlanner } from '../src/systems/obstacles/planner.js';
import { BOULDER, RING, SPINNER, applyTime, fillRingNodes, speedAt, timeAtDistance } from '../src/systems/obstacles/dynamics.js';
import { PATTERNS, UNLOCK } from '../src/systems/obstacles/patterns.js';
import { difficultyAt } from '../src/systems/obstacles/spawner.js';
import { RENDER_CAPS } from '../src/systems/obstacles/renderCaps.js';
import { PHYSICS, WORLD, SCORING, STREAK, POWERUPS } from '../src/systems/physics/constants.js';
import { modelScores } from './balance-model.mjs';
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
const freeSim = (seed = 3) => {
  const s = createGameSim();
  s.reset(seed);
  s.obstacles.releaseAll();
  s.orbs.releaseAll();
  s.track.nextX = 1e9;
  return s;
};

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
check('score = distance points + bonus points', computeScore(100, 7) === 100 * SCORING.pointsPerMetre + 7);
check('multipliers never touch distance', computeScore(100, 0) === 100 * SCORING.pointsPerMetre);

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

// ---------------------------------------------------------------- track generation
section('Timeline & planner');
{
  // Arrival times predicted for any track position must match the real simulation.
  const s = freeSim(2);
  s.flap();
  let worst = 0;
  for (let i = 0; i < 120 * 70; i++) {
    s.bird.y = 0.4;
    s.bird.vy = 0;
    s.step(DT);
    if (i % 600 === 0) worst = Math.max(worst, Math.abs(s.runTime - timeAtDistance(s.distance)));
  }
  check('predicted arrival times match the sim', worst < 0.01, `${worst}`);
  check('speed matches the sim', Math.abs(s.speed - speedAt(s.distance)) < 0.01);

  const planner = createPlanner();
  const start = new Uint8Array(CELLS);
  const out = new Uint8Array(CELLS);
  start[cellOf(0.4)] = 1;
  const box = (x, bottom, top, hw = 0.6) => ({ shape: 'box', dyn: '', x, y: (bottom + top) / 2, hw, hh: (top - bottom) / 2, extent: hw });
  check('open sky is passable', planner.validate(start, 0, 30, [], out));
  check('a gate with a roomy gap is passable', planner.validate(start, 0, 30, [box(15, -6, -0.8), box(15, 2.4, 14)], out));
  check('a wall across the whole band is rejected', !planner.validate(start, 0, 30, [box(15, -6, 14)], out));
  check('a gap too small for the bird is rejected', !planner.validate(start, 0, 30, [box(15, -6, 0.2), box(15, 0.7, 14)], out));
  // Cannot climb 4 units in the 0.4 s before the gap.
  check('a gap too far to reach in time is rejected', !planner.validate(start, 8, 12, [box(11.5, -6, 2.6), box(11.5, 5.5, 14)], out));
  // Two gaps in a wall: both are reported as places the bird can be afterwards.
  check('a wall with two openings is passable', planner.validate(start, 0, 30, [box(15, -6, -1.4), box(15, 0.4, 0.9), box(15, 2.4, 14)], out));
  // A moving hazard: a geyser's blocking changes with time, and the planner sees it.
  const gey = { shape: 'box', kind: 'geyser', dyn: 'geyser', x: 15, w: 1.1, hw: 0.44, extent: 0.55, p1: 0, p2: Math.PI, p3: timeAtDistance(15), p4: -2.7, p5: 3.0, y: 0, h: 1, hh: 1 };
  applyTime(gey, gey.p3);
  const low = gey.y + gey.h / 2; // at its rest phase s=0: just a stub
  applyTime(gey, gey.p3 + 1);
  const high = gey.y + gey.h / 2; // half a period later: full height
  check('geyser rises and falls on its beat', low < -2.5 && high > 2.9, `${low.toFixed(2)} -> ${high.toFixed(2)}`);
}

section('Planner agrees with the collision code');
{
  // The planner solves "which heights touch this obstacle" directly; it must match trying
  // circleHitsObstacle at every height, for every collider shape.
  const planner = createPlanner();
  const out = new Uint8Array(CELLS);
  const rng = createRng(909);
  let mismatches = 0;
  let cases = 0;
  for (let i = 0; i < 3000; i++) {
    const kind = i % 3;
    const o =
      kind === 0
        ? { shape: 'box', x: rng.range(-2, 2), y: rng.range(-3, 4), hw: rng.range(0.2, 1), hh: rng.range(0.3, 3) }
        : kind === 1
          ? { shape: 'circle', x: rng.range(-2, 2), y: rng.range(-3, 4), cr: rng.range(0.3, 1.2) }
          : { shape: 'nodes', x: 0, y: 0, nr: rng.range(0.2, 0.3), nodeCount: 4, nodes: new Float32Array(20) };
    if (kind === 2) for (let n = 0; n < 4; n++) {
      o.nodes[n * 2] = rng.range(-1.5, 1.5);
      o.nodes[n * 2 + 1] = rng.range(-2.5, 3.5);
    }
    const px = rng.range(-2.5, 2.5);
    const r = PHYSICS.birdRadius + rng.range(0, 0.4);
    planner.blockedCells(o, px, r, out);
    for (let c = 0; c < CELLS; c++) {
      cases++;
      const hit = circleHitsObstacle(px, cellY(c), r, o);
      // Cells within a hair of the boundary may differ by floating-point rounding only.
      if (hit !== (out[c] === 1)) {
        const edge = Math.abs(clearanceToObstacle(px, cellY(c), r, o));
        if (edge > 1e-6) mismatches++;
      }
    }
  }
  check('planner blocks exactly the heights the collision code would', mismatches === 0, `${mismatches} of ${cases}`);
}

section('Generated tracks');
{
  const SEEDS = 24;
  const REACH = 4000;
  const firstSeen = {};
  let unverified = 0;
  let emptyReach = 0;
  let sections = 0;
  let rejected = 0;
  let maxAhead = 0;
  let minGapTime = Infinity;
  let rings = 0;
  const hardBuckets = [0, 0, 0, 0];
  const bucketTotals = [0, 0, 0, 0];
  const MOVINGSET = new Set(['geysers', 'spinner', 'boulders']);
  let movingBackToBack = 0;
  let minMovingRunUp = Infinity;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const s = createGameSim();
    s.reset(seed);
    for (let d = 0; d <= REACH; d += 2) {
      s.distance = s.prevDistance = d;
      s.phase = PHASE.RUNNING;
      s.step(0);
      s.events.length = 0;
      let ahead = 0;
      for (const c of s.track.corridors) if (c.x0 > d && c.x0 < d + 30) ahead++;
      for (const o of s.obstacles.active) if (o.x + o.extent < d - 20) s.obstacles.release(o);
      for (const o of s.orbs.active) if (o.x < d - 20) s.orbs.release(o);
      maxAhead = Math.max(maxAhead, ahead);
      s.bird.y = 0.4;
      let any = 0;
      for (let i = 0; i < CELLS; i++) any += s.track.reach[i];
      if (!any) emptyReach++;
    }
    const st = s.track.stats;
    unverified += st.unverified;
    sections += st.sections;
    rejected += st.rejected;
    rings += st.rings;
    // Replay the corridor log for pacing statistics (kept for the last stretch only, so regenerate).
    const s2 = createGameSim();
    s2.reset(seed);
    const log = [];
    for (let d = 0; d <= REACH; d += 2) {
      s2.distance = s2.prevDistance = d;
      s2.phase = PHASE.RUNNING;
      s2.step(0);
      s2.events.length = 0;
      for (const c of s2.track.corridors) if (!log.find((l) => l.x0 === c.x0)) log.push({ ...c });
      for (const o of s2.obstacles.active) if (o.x + o.extent < d - 20) s2.obstacles.release(o);
      for (const o of s2.orbs.active) if (o.x < d - 20) s2.orbs.release(o);
      s2.bird.y = 0.4;
    }
    log.forEach((c, i) => {
      if (firstSeen[c.type] === undefined || c.x0 < firstSeen[c.type]) firstSeen[c.type] = c.x0;
      const b = Math.min(3, Math.floor(c.x0 / 1000));
      bucketTotals[b]++;
      if (MOVINGSET.has(c.type)) hardBuckets[b]++;
      if (i && MOVINGSET.has(c.type) && MOVINGSET.has(log[i - 1].type)) movingBackToBack++;
      if (i) minGapTime = Math.min(minGapTime, (c.x0 - log[i - 1].x1) / speedAt(c.x0));
      if (i && MOVINGSET.has(c.type)) minMovingRunUp = Math.min(minMovingRunUp, c.x0 - log[i - 1].x1);
    });
  }
  console.log(`  ${sections} sections over ${SEEDS} tracks of ${REACH} m; ${rejected} proposals rejected by the planner; ${rings} rings`);
  check('no section ships without a verified route', unverified === 0, `${unverified}`);
  check('there is always somewhere the bird can be', emptyReach === 0, `${emptyReach}`);
  check('the planner does reject unsafe proposals', rejected > 0);
  check('moving hazards never follow each other', movingBackToBack === 0, `${movingBackToBack}`);
  check('every moving hazard has a >= 10.5 m run-up', minMovingRunUp >= 10.5 - 1e-9, `${minMovingRunUp.toFixed(2)}`);
  check('at most 4 sections begin within any 30 m', maxAhead <= 4, `${maxAhead}`);
  check('sections are never closer than 0.55 s apart', minGapTime > 0.55, `${minGapTime.toFixed(2)}`);
  // New hazards unlock one at a time and never early.
  for (const [type, at] of Object.entries(UNLOCK)) {
    if (firstSeen[type] === undefined) continue;
    check(`${type} not seen before its unlock (${at} m)`, firstSeen[type] >= at - 1, `first at ${Math.round(firstSeen[type])}`);
  }
  check('every pattern appears', Object.keys(UNLOCK).every((t) => firstSeen[t] !== undefined), JSON.stringify(Object.keys(UNLOCK).filter((t) => firstSeen[t] === undefined)));
  const share = hardBuckets.map((h, i) => (bucketTotals[i] ? h / bucketTotals[i] : 0));
  console.log(`  moving-hazard share per 1000 m: ${share.map((v) => (v * 100).toFixed(0) + '%').join(', ')}`);
  check('moving hazards grow more common with distance', share[0] < share[1] && share[1] <= share[3] + 0.08, share.join(','));
}

section('Moving hazards are avoidable from any height with little warning');
{
  // Re-check every generated moving-hazard section independently: starting at ANY height
  // only SIGHT_DISTANCE before it, the planner must still find a way through.
  const planner = createPlanner();
  const everywhere = new Uint8Array(CELLS).fill(1);
  const out = new Uint8Array(CELLS);
  const MOVINGSET = new Set(['geysers', 'spinner', 'boulders']);
  let checked = 0;
  let bad = 0;
  let sensitive = 0;
  let sightRejected = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const s = createGameSim();
    s.reset(seed);
    const done = new Set();
    for (let d = 0; d <= 3000; d += 2) {
      s.distance = s.prevDistance = d;
      s.phase = PHASE.RUNNING;
      s.step(0);
      s.events.length = 0;
      for (const c of s.track.corridors) {
        if (!MOVINGSET.has(c.type) || done.has(c.x0)) continue;
        done.add(c.x0);
        const obs = [...s.obstacles.active].filter((o) => o.x >= c.x0 - 0.5 && o.x <= c.x1 + 0.5);
        const first = Math.min(...obs.filter((o) => o.dyn).map((o) => o.x - o.extent));
        checked++;
        // The grid model has a one-step quantisation, so a marginal section can flip with how the
        // samples line up. Count those (information only): `npm run test:route -- --sight` is the
        // referee, searching real flap physics from every start height.
        for (const shift of [0.03, 0.08, 0.13, 0.21, 0.29]) {
          if (!planner.validate(everywhere, first - SIGHT_DISTANCE - shift, c.x1 + 0.8, obs, out, MOVING_MARGIN)) {
            sensitive++;
            break;
          }
        }
      }
      for (const o of s.obstacles.active) if (o.x + o.extent < d - 20) s.obstacles.release(o);
      for (const o of s.orbs.active) if (o.x < d - 20) s.orbs.release(o);
      s.bird.y = 0.4;
    }
    sightRejected += s.track.stats.sightRejected;
  }
  console.log(`  ${checked} moving-hazard sections re-checked; the generator rejected ${sightRejected} proposals for this reason; ${sensitive} are sensitive to sample alignment (grid quantisation)`);
  check('moving-hazard sections were checked', checked > 100, `${checked}`);
  check('every one is avoidable from any height with only 11 u of warning', bad === 0, `${bad} of ${checked}`);
}

section('Determinism');
{
  // Same seed, same track (rejected proposals and rollbacks included): a daily challenge needs this.
  const layout = (seed) => {
    const s = createGameSim();
    s.reset(seed);
    const out = [];
    for (let d = 0; d <= 1500; d += 2) {
      s.distance = s.prevDistance = d;
      s.phase = PHASE.RUNNING;
      s.step(0);
      s.events.length = 0;
      for (const o of s.obstacles.active) {
        if (o.x + o.extent < d - 10) {
          // Log each obstacle exactly once, as it is recycled (before the sim's own 16 u cleanup).
          out.push(`${o.kind}@${o.x.toFixed(4)},${o.dyn ? o.p1.toFixed(4) + '/' + o.p3.toFixed(4) : o.y.toFixed(4)}`);
          s.obstacles.release(o);
        }
      }
      for (const o of s.orbs.active) if (o.x < d - 20) s.orbs.release(o);
      s.bird.y = 0.4;
    }
    return out.join('|');
  };
  const first = layout(17);
  check('the generated track is long enough to compare', first.length > 5000, `${first.length}`);
  check('the same seed gives the same track', first === layout(17));
  check('different seeds give different tracks', layout(17) !== layout(18));
}

section('Renderer capacity');
{
  // Peak number of each drawn thing in the visible window, against what the renderers can draw.
  const peak = {};
  const bump = (k, v) => (peak[k] = Math.max(peak[k] || 0, v));
  for (let seed = 1; seed <= 24; seed++) {
    const s = createGameSim();
    s.reset(seed);
    for (let d = 0; d <= 4000; d += 2) {
      s.distance = s.prevDistance = d;
      s.phase = PHASE.RUNNING;
      s.step(0);
      s.events.length = 0;
      const c = {};
      for (const o of s.obstacles.active) {
        if (o.x + o.extent < d - 20) {
          s.obstacles.release(o);
          continue;
        }
        const x = o.x - d;
        if (x < -20 - o.extent || x > 60) continue;
        c[o.kind] = (c[o.kind] || 0) + 1;
      }
      const pick = { orb: 0, gem: 0, shield: 0, magnet: 0 };
      for (const o of s.orbs.active) {
        if (o.x < d - 20) {
          s.orbs.release(o);
          continue;
        }
        const x = o.x - d;
        if (x < -15 || x > 60) continue;
        pick[['orb', 'gem', 'shield', 'magnet'][o.kind]]++;
      }
      Object.assign(c, pick);
      for (const [k, v] of Object.entries(c)) bump(k, v);
      s.bird.y = 0.4;
    }
  }
  console.log(`  peak in view: ${Object.entries(peak).map(([k, v]) => `${k} ${v}/${RENDER_CAPS[k]}`).join(', ')}`);
  for (const [kind, cap] of Object.entries(RENDER_CAPS)) {
    if (peak[kind] === undefined) continue;
    check(`never more ${kind}s in view than are drawn (${cap})`, peak[kind] <= cap * 0.8, `${peak[kind]}`);
  }
}

// ---------------------------------------------------------------- streak & scoring (phase 3)
const levelStep = (s, n, y = WORLD.birdStartY) => {
  for (let i = 0; i < n && s.phase === PHASE.RUNNING; i++) {
    s.bird.y = y;
    s.bird.vy = 0;
    s.step(DT);
  }
};
const putOrb = (s, x, y = WORLD.birdStartY, kind = 0) => {
  const o = s.orbs.acquire();
  Object.assign(o, { x, y, phase: 0, kind, risk: false });
  return o;
};
const runningSim = (seed) => {
  const s = freeSim(seed);
  s.phase = PHASE.RUNNING;
  return s;
};
const eventsOf = (s, type) => s.events.filter((e) => e.type === type);

section('Streak and multiplier');
{
  // Tiers: x2 on the 5th collection, x3 on the 14th, and the orb that earns a tier is paid at it.
  const s = runningSim(61);
  for (let i = 0; i < 15; i++) putOrb(s, 3 + i * 3);
  const seen = [];
  for (let i = 0; i < 120 * 8; i++) {
    levelStep(s, 1);
    for (const e of s.events) if (e.type === 'orb') seen.push({ n: e.streak, mult: e.mult });
    if (s.events.some((e) => e.type === 'multiplier')) s.lastMultEvents = (s.lastMultEvents || 0) + eventsOf(s, 'multiplier').length;
    s.events.length = 0;
  }
  check('15 orbs collected', s.orbsCollected === 15, `${s.orbsCollected}`);
  check('x1 up to the 4th orb', seen.slice(0, 4).every((e) => e.mult === 1));
  check('the 5th orb reaches x2', seen[4].mult === 2 && seen[3].mult === 1);
  check('x2 holds through the 13th, x3 on the 14th', seen[12].mult === 2 && seen[13].mult === 3);
  // 4 at x1, 9 at x2 (orbs 5-13), 2 at x3 (orbs 14-15)
  check('each orb is paid at the multiplier it has just reached', s.points.orbs === SCORING.orbPoints * (4 * 1 + 9 * 2 + 2 * 3), `${s.points.orbs}`);
  check('one multiplier event per tier reached', s.lastMultEvents === 2, `${s.lastMultEvents}`);
  check('best streak and top multiplier are tracked', s.streak.best === 15 && s.streak.maxMult === 3);
}
{
  // The timer is the missed-opportunity rule: just inside the window keeps it, just outside ends it.
  const gapUnits = (seconds) => seconds * speedAt(0);
  const make = (gapSeconds) => {
    const s = runningSim(62);
    putOrb(s, 3);
    putOrb(s, 3 + gapUnits(gapSeconds));
    levelStep(s, 120 * 8);
    return s;
  };
  const inside = make(STREAK.window - 0.3);
  check('a gap inside the window keeps the streak', inside.streak.best === 2);
  const outside = make(STREAK.window + 0.4);
  check('a gap outside the window ends it', outside.streak.best === 1 && eventsOf(outside, 'streakBreak').length >= 1);
  const br = eventsOf(outside, 'streakBreak')[0];
  check('the break reports what happened', br && br.reason === 'timeout' && br.count === 1);
  check('after a break the multiplier is x1 again', outside.streak.mult === 1 && outside.streak.count === 0);
}
{
  // Which collections count toward the streak.
  const s = runningSim(63);
  putOrb(s, 3);
  putOrb(s, 6, WORLD.birdStartY, 1); // gem
  putOrb(s, 9, WORLD.birdStartY, 2); // shield: power-ups do not add to the streak
  putOrb(s, 12, WORLD.birdStartY, 3); // magnet
  levelStep(s, 120 * 3);
  check('orbs and gems extend the streak; power-ups do not', s.streak.count === 2, `${s.streak.count}`);
  check('shield and magnet were picked up', s.shield === true && s.magnetTime > 0);
}
{
  // Near misses pay, at the current multiplier, and do not touch the streak.
  const pass = (mult) => {
    const s = freeSim(64);
    s.phase = PHASE.RUNNING;
    s.streak.mult = mult;
    s.streak.count = mult > 1 ? 99 : 0;
    s.streak.timeLeft = 99;
    const R = PHYSICS.birdRadius;
    const o = s.obstacles.acquire();
    Object.assign(o, { kind: 'column', shape: 'box', x: 6, y: 1.0 + R + 0.1 + 3, hw: 0.5, hh: 3, extent: 0.625, minClear: Infinity, nearDone: false, dyn: '' });
    levelStep(s, 120 * 3, 1.0);
    return s;
  };
  const x1 = pass(1);
  const x3 = pass(3);
  check('a near miss pays', x1.nearMisses === 1 && x1.points.nearMiss >= SCORING.nearMissMin);
  check('near-miss points are multiplied like every other bonus', x3.points.nearMiss === x1.points.nearMiss * 3, `${x1.points.nearMiss} -> ${x3.points.nearMiss}`);
  check('a near miss does not add to the streak', x1.streak.count === 0);
}
{
  // Distance is never multiplied, and every point is accounted for in the ledger.
  const lo = runningSim(65);
  const hi = runningSim(65);
  hi.streak.mult = 5;
  hi.streak.count = 99;
  hi.streak.timeLeft = 9999;
  levelStep(lo, 120 * 6);
  levelStep(hi, 120 * 6);
  check('distance points ignore the multiplier', lo.score === hi.score && hi.results().points.distance === hi.metres * SCORING.pointsPerMetre, `${lo.score} vs ${hi.score}`);
  const r = (() => {
    const s = runningSim(66);
    for (let i = 0; i < 8; i++) putOrb(s, 3 + i * 3);
    putOrb(s, 30, WORLD.birdStartY, 1);
    levelStep(s, 120 * 8);
    return s.results();
  })();
  const sum = r.points.distance + r.points.orbs + r.points.gems + r.points.rings + r.points.nearMiss + r.points.other;
  check('the ledger adds up to the score', sum === r.score, `${sum} vs ${r.score}`);
  check('the ledger counts match the pickups', r.orbs === 8 && r.gems === 1);
}

section('Shield');
{
  const wall = (s, x) => {
    const o = s.obstacles.acquire();
    Object.assign(o, { kind: 'column', shape: 'box', x, y: 0.4, hw: 0.5, hh: 3, extent: 0.75, minClear: Infinity, nearDone: false, dyn: '' });
    return o;
  };
  const s = runningSim(71);
  s.shield = true;
  s.streak.count = 12;
  s.streak.mult = 3;
  s.streak.timeLeft = 5;
  wall(s, 4);
  levelStep(s, 120 * 2);
  check('a shield absorbs the hit: no crash', s.phase === PHASE.RUNNING && eventsOf(s, 'crash').length === 0);
  check('the shield is used up', s.shield === false && s.shieldsUsed === 1);
  const sb = eventsOf(s, 'shieldBreak');
  check('the break is announced once, with its cause', sb.length === 1 && sb[0].cause === 'obstacle');
  const brk = eventsOf(s, 'streakBreak');
  check('taking a hit ends the streak', brk.length === 1 && brk[0].reason === 'shield' && s.streak.count === 0 && s.streak.mult === 1);
  {
    // Right after the hit, the grace period is at its full length.
    const w = runningSim(76);
    w.shield = true;
    wall(w, 4);
    for (let i = 0; i < 120 * 2 && !w.events.some((e) => e.type === 'shieldBreak'); i++) {
      w.bird.y = WORLD.birdStartY;
      w.bird.vy = 0;
      w.step(DT);
    }
    check('right after a shield breaks, the grace period is at full length', w.invuln > POWERUPS.shieldGrace - 0.05, `${w.invuln}`);
  }
  // After the grace period the next hit is fatal.
  const t = runningSim(72);
  t.shield = true;
  wall(t, 4);
  levelStep(t, 120 * 2.2); // hit, then grace runs out (1.5 s) while flying on
  wall(t, t.distance + 3);
  levelStep(t, 120 * 2);
  check('without a shield the next hit ends the run', t.phase !== PHASE.RUNNING && eventsOf(t, 'crash').length === 1);
  // Collisions are ignored during the grace period.
  const g = runningSim(73);
  g.shield = true;
  wall(g, 4);
  levelStep(g, 120 * 1.2);
  wall(g, g.distance + 2);
  levelStep(g, 120 * 0.8);
  check('hits inside the grace period are ignored', g.phase === PHASE.RUNNING && g.shieldsUsed === 1);
  // Lava: a shield turns it into a bounce.
  const l = runningSim(74);
  l.shield = true;
  l.bird.y = WORLD.groundY + PHYSICS.birdRadius - 0.05;
  l.step(DT);
  check('a shield turns lava into a bounce', l.phase === PHASE.RUNNING && l.bird.vy > 5 && l.shield === false);
  const sb2 = eventsOf(l, 'shieldBreak');
  check('lava break reports its cause', sb2[0] && sb2[0].cause === 'lava');
  // A second shield picked up while holding one is worth a flat bonus.
  const d = runningSim(75);
  putOrb(d, 3, WORLD.birdStartY, 2);
  putOrb(d, 6, WORLD.birdStartY, 2);
  levelStep(d, 120 * 3);
  check('a duplicate shield pays a flat bonus and keeps one shield', d.shield && d.points.other === SCORING.shieldDuplicate, `${d.points.other}`);
}

section('Magnet');
{
  const run = (setup) => {
    const s = runningSim(81);
    setup(s);
    levelStep(s, 120 * 3);
    return s;
  };
  const off = run((s) => putOrb(s, 6, WORLD.birdStartY + 2.2));
  check('without a magnet an orb 2.2 u off the line is missed', off.orbsCollected === 0);
  const on = run((s) => {
    s.magnetTime = POWERUPS.magnetTime;
    putOrb(s, 6, WORLD.birdStartY + 2.2);
  });
  check('a magnet pulls it in', on.orbsCollected === 1);
  const far = run((s) => {
    s.magnetTime = POWERUPS.magnetTime;
    putOrb(s, 6, WORLD.birdStartY + POWERUPS.magnetRadius + 1.2);
  });
  check('an orb beyond the pull radius is left alone', far.orbsCollected === 0);
  const gem = run((s) => {
    s.magnetTime = POWERUPS.magnetTime;
    putOrb(s, 6, WORLD.birdStartY + 2.2, 1);
  });
  check('gems are not pulled: they stay a reward for the risky line', gem.gemsCollected === 0);
  const timed = runningSim(82);
  timed.magnetTime = POWERUPS.magnetTime;
  levelStep(timed, Math.round(120 * (POWERUPS.magnetTime + 0.5)));
  check('the magnet runs out on time, announced once', timed.magnetTime === 0 && eventsOf(timed, 'magnetEnd').length === 1);
  const again = runningSim(83);
  putOrb(again, 3, WORLD.birdStartY, 3);
  levelStep(again, 120 * 4);
  const left = again.magnetTime;
  putOrb(again, again.distance + 3, WORLD.birdStartY, 3);
  levelStep(again, 120 * 1);
  check('a second magnet refreshes the timer', again.magnetTime > left && again.magnetsGot === 2);
}

section('Power-up placement');
{
  let total = 0;
  const kinds = { 2: 0, 3: 0 };
  let tooClose = 0;
  let firstAt = Infinity;
  let blocked = 0;
  for (let seed = 1; seed <= 24; seed++) {
    const s = createGameSim();
    s.reset(seed);
    const xs = [];
    for (let d = 0; d <= 4000; d += 2) {
      s.distance = s.prevDistance = d;
      s.phase = PHASE.RUNNING;
      s.step(0);
      s.events.length = 0;
      for (const orb of s.orbs.active) {
        if (orb.kind >= 2 && !xs.includes(orb.x)) {
          xs.push(orb.x);
          kinds[orb.kind]++;
          total++;
          firstAt = Math.min(firstAt, orb.x);
          for (const o of s.obstacles.active) {
            if (!o.dyn && circleHitsObstacle(orb.x, orb.y, PHYSICS.birdRadius + 0.3, o)) blocked++;
          }
        }
        if (orb.x < d - 12) s.orbs.release(orb);
      }
      for (const o of s.obstacles.active) if (o.x + o.extent < d - 12) s.obstacles.release(o);
      s.bird.y = 0.4;
    }
    xs.sort((a, b) => a - b);
    xs.forEach((x, i) => {
      if (i && x - xs[i - 1] < POWERUPS.spacingMin - 15) tooClose++;
    });
  }
  console.log(`  ${total} power-ups over 24 tracks of 4000 m: ${kinds[2]} shields, ${kinds[3]} magnets`);
  check('both power-ups appear', kinds[2] > 20 && kinds[3] > 20, JSON.stringify(kinds));
  check('power-ups are rare (about one per 340 m)', total / (24 * 4) > 1.5 && total / (24 * 4) < 4.5, `${(total / 96).toFixed(2)} per km`);
  check('the first one is not before the opening stretch', firstAt >= POWERUPS.firstAt - 30, `${firstAt.toFixed(0)}`);
  check('power-ups are spaced out', tooClose === 0, `${tooClose}`);
  check('a power-up is never placed inside a fixed obstacle', blocked === 0, `${blocked}`);
}

section('Scoring balance (distance stays the backbone)');
{
  const model = modelScores({ length: 3000, seeds: 8 });
  const pct = (r) => (100 * r.share).toFixed(0);
  console.log(`  distance share of a 3,000 m score: ${model.rows.map((r) => `${r.name.split(':')[0]} ${pct(r)}%`).join(', ')}`);
  const [casual, skilled, elite, ceiling] = model.rows;
  check('casual play: distance is at least 75% of the score', casual.share >= 0.75, pct(casual));
  check('skilled play: distance is at least 60% of the score', skilled.share >= 0.6, pct(skilled));
  check('elite play: distance is still at least 42%', elite.share >= 0.42, pct(elite));
  check('even every pickup on every route leaves distance at 33% or more', ceiling.share >= 0.33, pct(ceiling));
  check('collecting more always scores more', casual.total < skilled.total && skilled.total < elite.total && elite.total < ceiling.total);
}

section('Difficulty progression');
{
  // Gaps shrink, spacing tightens and speed rises monotonically; nothing eases off by accident.
  let mono = true;
  let prev = { gap: Infinity, speed: 0, diff: -1 };
  for (let d = 0; d <= 2400; d += 50) {
    const t = difficultyAt(d);
    const gap = 4.3 + (2.9 - 4.3) * t;
    const sp = speedAt(d);
    if (gap > prev.gap + 1e-9 || sp < prev.speed - 1e-9 || t < prev.diff - 1e-9) mono = false;
    prev = { gap, speed: sp, diff: t };
  }
  check('difficulty, speed and gap shrink never ease off', mono);
  // Moving hazards get faster/higher with difficulty.
  const rng = createRng(3);
  const fakeB = (log) => ({ geyser: (...a) => log.push(['geyser', a]), orb() {}, gem() {}, boulder: (...a) => log.push(['boulder', a]), spinner: (...a) => log.push(['spinner', a]), column() {}, block() {}, rock() {}, ring() {} });
  const sample = (type, t) => {
    const log = [];
    PATTERNS[type](fakeB(log), 100, 1, 3.6, rng, { t, timeAt: timeAtDistance });
    return log;
  };
  const spinEasy = Math.abs(sample('spinner', 0)[0][1][2]);
  const spinHard = Math.abs(sample('spinner', 1)[0][1][2]);
  check('spinners turn faster later', spinHard > spinEasy + 0.3, `${spinEasy.toFixed(2)} -> ${spinHard.toFixed(2)}`);
  const gEasy = sample('geysers', 0)[0][1][3];
  const gHard = sample('geysers', 1)[0][1][3];
  check('lava columns rise higher later', gHard > gEasy + 1, `${gEasy.toFixed(2)} -> ${gHard.toFixed(2)}`);
  check('first geyser section is shorter than a late one', sample('geysers', 0).length < sample('geysers', 1).length);
}

section('Reaction time & visibility');
{
  // Every boulder warns well before it moves, and starts moving well before the bird arrives.
  let minWarn = Infinity;
  let minFall = Infinity;
  let boulders = 0;
  for (let seed = 1; seed <= 16; seed++) {
    const s = createGameSim();
    s.reset(seed);
    for (let d = 0; d <= 2500; d += 2) {
      s.distance = s.prevDistance = d;
      s.phase = PHASE.RUNNING;
      s.step(0);
      s.events.length = 0;
      for (const o of s.obstacles.active) {
        if (o.kind === 'boulder' && !o.seen) {
          o.seen = true;
          boulders++;
          const arrive = timeAtDistance(o.x);
          minFall = Math.min(minFall, arrive - o.p3);
          minWarn = Math.min(minWarn, arrive - (o.p3 - BOULDER.armLead));
        }
        if (o.x + o.extent < d - 20) s.obstacles.release(o);
      }
      for (const o of s.orbs.active) if (o.x < d - 20) s.orbs.release(o);
      s.bird.y = 0.4;
    }
  }
  check('boulders appear in generated tracks', boulders > 5, `${boulders}`);
  check('a boulder is telegraphed >= 1.6 s before the bird arrives', minWarn >= 1.6, `${minWarn.toFixed(2)}`);
  check('a boulder is falling >= 0.7 s before the bird arrives', minFall >= 0.7, `${minFall.toFixed(2)}`);
}

section('Collision boundaries are fair');
{
  const s = createGameSim();
  let boulder = null;
  let geyser = null;
  let spin = null;
  let ring = null;
  for (let seed = 1; seed <= 40 && !(boulder && geyser && spin && ring); seed++) {
    s.reset(seed);
    for (let d = 0; d <= 3000; d += 20) {
      s.distance = s.prevDistance = d;
      s.phase = PHASE.RUNNING;
      s.step(0);
      s.events.length = 0;
      for (const o of s.obstacles.active) {
        if (o.kind === 'boulder') boulder ??= { ...o };
        if (o.kind === 'geyser') geyser ??= { ...o };
        if (o.kind === 'spinner') spin ??= { ...o, nodes: o.nodes.slice() };
        if (o.kind === 'ring') ring ??= { ...o, nodes: o.nodes.slice() };
        if (o.x + o.extent < d - 20) s.obstacles.release(o);
      }
      s.bird.y = 0.4;
    }
  }
  check('found every moving hazard type', boulder && geyser && spin && ring);
  check('boulder collider is inside its visual', boulder.cr <= boulder.r * 0.87);
  check('lava column collider is inside its visual', geyser.hw <= geyser.w * 0.45);
  const nr = spin.nr;
  const sp = SPINNER.offsets.slice().sort((a, b) => a - b);
  check('spinner arms have no gaps to slip through', sp.every((v, i) => i === 0 || v - sp[i - 1] <= 2 * nr + 1e-9));
  check('spinner collider is inside its drawn bar (0.6 thick)', nr <= 0.3);
  check('the opening in a ring is generous (>= 1.0 u of free height for the bird)', 2 * (RING.radius - RING.nodeRadius - PHYSICS.birdRadius) >= 1.0, `${(2 * (RING.radius - RING.nodeRadius - PHYSICS.birdRadius)).toFixed(2)}`);
  check('a ring is two rows of posts with nothing on the flight line', ring.nodes.slice(0, ring.nodeCount * 2).every((v, i) => i % 2 === 0 || Math.abs(v - ring.y) > RING.radius - 1e-6));
  // Hazards are deterministic functions of time: same state at the same run time, however often asked.
  const a = { ...spin, nodes: spin.nodes.slice() };
  const b2 = { ...spin, nodes: spin.nodes.slice() };
  applyTime(a, 33.3);
  applyTime(b2, 12);
  applyTime(b2, 33.3);
  check('moving hazards are pure functions of run time', a.nodes.every((v, i) => v === b2.nodes[i]));
}

section('Risk and reward');
{
  // Split gate: the narrow opening must pay clearly more than the wide one, and gems only sit there.
  let safeOrbs = 0;
  let hardOrbs = 0;
  let gems = 0;
  let gemsOnSafeRoute = 0;
  let sections = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const log = { orbs: [], gems: [], cols: [] };
    const b = {
      column: (cx, yb, yt) => log.cols.push([yb, yt]),
      orb: (x, y) => log.orbs.push(y),
      gem: (x, y) => log.gems.push(y),
    };
    const rng = createRng(seed);
    const center = rng.range(-0.5, 1.5);
    const gap = 3.8;
    const r = PATTERNS.splitGate(b, 100, center, gap, rng, { t: 0.5, timeAt: timeAtDistance });
    if (log.cols.length < 4) continue; // fell back to a plain gate
    sections++;
    const lo = center - gap / 2;
    const hi = center + gap / 2;
    for (const y of log.orbs) (y >= lo && y <= hi ? safeOrbs++ : hardOrbs++);
    for (const y of log.gems) {
      gems++;
      if (y >= lo && y <= hi) gemsOnSafeRoute++;
    }
  }
  console.log(`  split gates: ${sections}, orbs on the safe route ${safeOrbs}, on the risky route ${hardOrbs}, gems ${gems}`);
  check('risky route pays at least 4x the orbs of the safe route', hardOrbs >= 4 * safeOrbs, `${hardOrbs} vs ${safeOrbs}`);
  check('gems only ever sit in the narrow, risky opening', gemsOnSafeRoute === 0, `${gemsOnSafeRoute}`);
  check('gems are rare but present', gems > 0 && gems < hardOrbs * 0.35, `${gems}`);
  check('a gem is worth more than any orb', SCORING.gemPoints >= 4 * SCORING.orbPoints);
}

section('Pickups, rings and scoring');
{
  const gemSim = freeSim(51);
  const g = gemSim.orbs.acquire();
  Object.assign(g, { x: 1, y: WORLD.birdStartY + 0.6, phase: 0, kind: 1 });
  gemSim.flap();
  for (let i = 0; i < 60; i++) gemSim.step(DT);
  check('gem collected', gemSim.gemsCollected === 1 && gemSim.orbsCollected === 0);
  check('gem pays gemPoints', gemSim.score === gemSim.metres + SCORING.gemPoints, `${gemSim.score}`);
  const ev = gemSim.events.find((e) => e.type === 'orb');
  check('gem event is flagged', ev && ev.gem === true);
  check('results report gems and rings', gemSim.results().gems === 1 && gemSim.results().rings === 0);

  // Fire ring: flying through the middle pays once; flying through the rim is a crash.
  const ringAt = (yBird) => {
    const s = freeSim(52);
    s.phase = PHASE.RUNNING;
    const o = s.obstacles.acquire();
    Object.assign(o, { kind: 'ring', shape: 'nodes', dyn: '', x: 6, y: 1.0, z: 0, nr: RING.nodeRadius, nodeCount: RING.nodes, extent: RING.spread + RING.nodeRadius, r: RING.radius, h: 2 * (RING.radius + RING.nodeRadius), rr: RING.radius - RING.nodeRadius - 0.12, claimed: false, minClear: Infinity, nearDone: false, cap: 0 });
    o.nodes = new Float32Array(20);
    fillRingNodes(o, 6, 1.0);
    for (let i = 0; i < 120 * 2 && s.phase === PHASE.RUNNING; i++) {
      s.bird.y = yBird;
      s.bird.vy = 0;
      s.step(DT);
    }
    return s;
  };
  const through = ringAt(1.0);
  check('flying through a ring pays once', through.ringsPassed === 1 && through.events.filter((e) => e.type === 'ring').length === 1 && through.phase === PHASE.RUNNING);
  check('ring bonus is added to the score', through.score === through.metres + SCORING.ringPoints);
  const rim = ringAt(1.0 + RING.radius);
  check('flying into the rim is a crash, with no bonus', rim.phase !== PHASE.RUNNING && rim.ringsPassed === 0);
  const around = ringAt(1.0 + RING.radius + RING.nodeRadius + PHYSICS.birdRadius + 0.4);
  check('flying around a ring is free', around.phase === PHASE.RUNNING && around.ringsPassed === 0);

  // A boulder: a landing is announced once, and it vanishes afterwards.
  const bs = freeSim(53);
  bs.phase = PHASE.RUNNING;
  const bo = bs.obstacles.acquire();
  Object.assign(bo, { kind: 'boulder', dyn: 'boulder', shape: 'circle', x: 40, z: 0, r: 0.85, cr: 0.73, extent: 0.85, p1: BOULDER.startY, p2: BOULDER.gravity, p3: 0.5, arm: 0, landed: false, gone: false, landedSent: false, minClear: Infinity, nearDone: false, cap: 0, y: 7, h: 1.7 });
  let landings = 0;
  for (let i = 0; i < 120 * 3; i++) {
    bs.bird.y = 1.0;
    bs.bird.vy = 0;
    bs.step(DT);
    landings += bs.events.filter((e) => e.type === 'boulderLand').length;
    bs.events.length = 0;
  }
  check('a boulder announces its landing once', landings === 1, `${landings}`);
  check('a landed boulder sinks away', bo.gone === true);
}

// ---------------------------------------------------------------- flight feel (phase 1)

section('Flight feel');
{
  // Reach must stay put: the track generator's fairness model assumes it.
  const peak = (hold) => {
    const s = freeSim();
    s.setHolding(hold);
    s.flap();
    let max = -Infinity;
    for (let i = 0; i < 240; i++) {
      s.step(DT);
      max = Math.max(max, s.bird.y);
    }
    return max - WORLD.birdStartY;
  };
  const tap = peak(false);
  const hold = peak(true);
  check('tap reach preserved (~1.28 u)', tap > 1.18 && tap < 1.4, `${tap.toFixed(2)}`);
  check('hold reach preserved (~1.84 u)', hold > 1.7 && hold < 2.0, `${hold.toFixed(2)}`);

  // Release feels weighted: a free fall is faster than plain gravity would give.
  const s = freeSim();
  s.flap();
  s.step(DT); // applies the queued flap
  while (s.bird.vy > 0) s.step(DT);
  for (let i = 0; i < 36; i++) s.step(DT); // 0.3 s of free fall after the apex
  check('release falls with weight', s.bird.vy < -0.3 * 22 - 0.2, `${s.bird.vy.toFixed(2)}`);
  check('fall stays under terminal speed', s.bird.vy >= PHYSICS.maxFallSpeed - 1e-9);
}
{
  // Dive ramps in: no velocity jump bigger than the strongest gravity allows.
  const s = freeSim();
  s.flap();
  s.step(DT);
  s.setDive(true);
  let maxJump = 0;
  let minVy = 0;
  let prev = s.bird.vy;
  for (let i = 0; i < 70 && s.phase === PHASE.RUNNING; i++) {
    s.step(DT);
    maxJump = Math.max(maxJump, Math.abs(s.bird.vy - prev));
    prev = s.bird.vy;
    minVy = Math.min(minVy, s.bird.vy);
  }
  check('dive builds without snapping', maxJump < Math.abs(PHYSICS.gravity) * PHYSICS.diveGravityScale * DT * 1.05, `${maxJump.toFixed(3)}`);
  check('dive reaches full dive speed', minVy <= PHYSICS.maxDiveSpeed + 0.5, `${minVy.toFixed(2)}`);
  check('dive ramps its strength', s.bird.diveAmt > 0.99);
  s.setDive(false);
  const vAtRelease = s.bird.vy;
  s.step(DT);
  check('dive release does not snap speed', Math.abs(s.bird.vy - vAtRelease) < 0.5);
}
{
  // Body springs: bounded, and they settle (visual only).
  const s = freeSim();
  s.flap();
  let maxPitch = 0;
  let minPitch = 0;
  let maxRoll = 0;
  for (let i = 0; i < 90; i++) {
    s.step(DT);
    maxPitch = Math.max(maxPitch, s.bird.pitch);
    minPitch = Math.min(minPitch, s.bird.pitch);
    maxRoll = Math.max(maxRoll, Math.abs(s.bird.roll));
  }
  check('pitch within visual limits', maxPitch < 0.6 && minPitch > -1.15, `${minPitch.toFixed(2)}..${maxPitch.toFixed(2)}`);
  check('bank is bounded', maxRoll > 0.01 && maxRoll < 0.45, `${maxRoll.toFixed(3)}`);
}

// ---------------------------------------------------------------- frame-rate independence
section('Frame-rate independence (real fixed-step driver)');
{
  // Same inputs at the same simulated times, driven at different display refresh rates.
  const FLAP_TIMES = [0, 0.4, 0.8, 1.2, 1.6];
  const run = (fps, holdTill = 0.3) => {
    const s = freeSim(21);
    const stepper = createStepper(s);
    const frame = 1 / fps;
    let simTime = 0;
    let next = 0;
    s.setHolding(true);
    const total = Math.round(2.4 * fps);
    for (let f = 0; f < total; f++) {
      if (next < FLAP_TIMES.length && simTime >= FLAP_TIMES[next] - 1e-9) {
        s.flap();
        next++;
      }
      if (simTime >= holdTill) s.setHolding(false);
      stepper.advance(frame);
      simTime += frame;
    }
    return { y: s.bird.y, vy: s.bird.vy, pitch: s.bird.pitch, roll: s.bird.roll, d: s.distance, phase: s.phase };
  };
  const ref = run(120);
  for (const fps of [30, 60, 240]) {
    const r = run(fps);
    const err = Math.max(Math.abs(r.y - ref.y), Math.abs(r.vy - ref.vy), Math.abs(r.pitch - ref.pitch), Math.abs(r.roll - ref.roll), Math.abs(r.d - ref.d));
    check(`${fps} fps matches 120 fps`, err < 1e-6 && r.phase === ref.phase, `err ${err}`);
  }
  // Frame times that don't divide the step (75, 144 fps) can only differ by input-timing quantisation.
  for (const fps of [75, 144]) {
    const r = run(fps);
    check(`${fps} fps stays close to 120 fps`, Math.abs(r.y - ref.y) < 0.25 && Math.abs(r.d - ref.d) < 0.12, `dy ${(r.y - ref.y).toFixed(3)} dd ${(r.d - ref.d).toFixed(3)}`);
  }
  // Irregular frame times: distance travelled depends only on elapsed time.
  const s = freeSim(22);
  const stepper = createStepper(s);
  const rng = createRng(5);
  s.flap();
  let elapsed = 0;
  while (elapsed < 0.7) {
    const dt = rng.range(0.004, 0.04);
    stepper.advance(dt);
    elapsed += dt;
  }
  const expected = s.time;
  check('jittery frames: sim time tracks real time', Math.abs(expected - elapsed) < PHYSICS.fixedStep + 1e-9, `${expected} vs ${elapsed}`);
  // A huge hitch is clamped, never a giant leap.
  const h = freeSim(23);
  const hs = createStepper(h);
  h.flap();
  hs.advance(5);
  check('long hitch is clamped', h.time <= PHYSICS.maxFrameDelta + PHYSICS.fixedStep);
}

// ---------------------------------------------------------------- collision accuracy
section('Collision accuracy preserved');
{
  const rng = createRng(77);
  let agree = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) {
    const o =
      i % 2
        ? { shape: 'box', x: rng.range(-2, 2), y: rng.range(-2, 2), hw: rng.range(0.2, 1), hh: rng.range(0.3, 2) }
        : { shape: 'circle', x: rng.range(-2, 2), y: rng.range(-2, 2), cr: rng.range(0.3, 1.2) };
    const cx = rng.range(-3, 3);
    const cy = rng.range(-3, 3);
    const hit = circleHitsObstacle(cx, cy, PHYSICS.birdRadius, o);
    const clear = clearanceToObstacle(cx, cy, PHYSICS.birdRadius, o);
    if (hit === clear < 0) agree++;
  }
  check('clearance < 0 exactly when the collider is hit', agree === N, `${agree}/${N}`);
}

// ---------------------------------------------------------------- near miss & impact
section('Near-miss feedback');
{
  // Fly level past a box whose underside leaves `gap` of clearance above the bird's edge.
  const pass = (gap, extra) => {
    const s = freeSim(31);
    s.phase = PHASE.RUNNING;
    const y = 1.0;
    const R = PHYSICS.birdRadius;
    const mk = (x, bottom) => {
      const o = s.obstacles.acquire();
      Object.assign(o, { kind: 'column', shape: 'box', x, y: bottom + 3, hw: 0.5, hh: 3, extent: 0.625, minClear: Infinity, nearDone: false });
    };
    mk(6, y + R + gap);
    if (extra) mk(6.9, y + R + gap + 0.02); // a gate's second column right behind
    for (let i = 0; i < 120 * 3 && s.phase === PHASE.RUNNING; i++) {
      s.bird.y = y;
      s.bird.vy = 0;
      s.step(DT);
    }
    return { events: s.events.filter((e) => e.type === 'nearMiss'), phase: s.phase };
  };
  const close = pass(0.12);
  check('close pass raises one near-miss', close.events.length === 1 && close.phase === PHASE.RUNNING);
  check('near-miss reports clearance and side', Math.abs(close.events[0].clearance - 0.12) < 0.03 && close.events[0].side === 1, JSON.stringify(close.events[0]));
  check('wide pass raises none', pass(0.6).events.length === 0);
  check('two columns in a row give one cue', pass(0.1, true).events.length === 1);
}
section('Impact feedback');
{
  const sim = createGameSim();
  sim.reset(41);
  sim.flap();
  for (let i = 0; i < 120 * 4 && sim.phase === PHASE.RUNNING; i++) sim.step(DT);
  const crash = sim.events.find((e) => e.type === 'crash');
  check('lava crash reports its cause', crash && crash.cause === 'lava');

  const o = freeSim(42);
  const ob = o.obstacles.acquire();
  Object.assign(ob, { kind: 'column', shape: 'box', x: 3, y: 0.4, hw: 0.5, hh: 3, extent: 0.75, minClear: Infinity, nearDone: false });
  o.flap();
  for (let i = 0; i < 240 && o.phase === PHASE.RUNNING; i++) {
    if (o.bird.vy < 0) o.flap();
    o.step(DT);
  }
  const hit = o.events.find((e) => e.type === 'crash');
  check('obstacle crash reports its cause', hit && hit.cause === 'obstacle');
  check('no near-miss alongside a hit', !o.events.some((e) => e.type === 'nearMiss'));

  // Hit-stop: the world is near-frozen for the first instant, then carries on.
  const d0 = o.distance;
  const nominal = o.speed;
  for (let i = 0; i < 6; i++) o.step(DT); // 0.05 s
  check('hit-stop freezes the impact moment', o.distance - d0 < nominal * 0.05 * 0.3, `${(o.distance - d0).toFixed(3)} of ${(nominal * 0.05).toFixed(3)}`);
  for (let i = 0; i < 120 * 3; i++) o.step(DT);
  check('game over still arrives after hit-stop', o.phase === PHASE.OVER);
  check('over event exactly once', countEvents(o, 'over') === 1);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
