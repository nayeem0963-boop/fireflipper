/**
 * Physics-level survivability proof. Run with: npm run test:route
 *
 * For each seed, generates the track and then searches over the bird's REAL
 * flight state (height and vertical speed, advanced with the game's own flap
 * physics) for ANY sequence of taps and holds that survives it. The set of
 * still-alive states is carried forward one decision (0.1 s) at a time; if
 * it ever becomes empty, the track contained an unavoidable combination.
 *
 * Every stored state is the exact state of an actual trajectory, and states
 * that fall in the same grid cell are merged by keeping one of them, so the
 * search can only under-approximate what is possible: a pass is a real flap
 * schedule. The bird is inflated by an extra margin, so passing also means
 * the route has slack. It uses 1/60 s physics steps (the game uses 1/120 s).
 *
 *   node scripts/route-test.mjs [seeds=4] [metres=1200]
 *   node scripts/route-test.mjs 1 300 --sabotage   self-check: plants an impassable wall; must FAIL
 *   node scripts/route-test.mjs 8 2500 --sight      every moving-hazard section, started from EVERY height
 *                                                   with only 11 u of warning (a narrow phone at top speed)
 */
import { createGameSim, PHASE } from '../src/systems/game/createGameSim.js';
import { PHYSICS, WORLD } from '../src/systems/physics/constants.js';
import { applyFlap, stepFlight } from '../src/systems/physics/flight.js';
import { circleHitsObstacle } from '../src/systems/physics/collision.js';
import { applyTime, speedAt, timeAtDistance } from '../src/systems/obstacles/dynamics.js';
import { SIGHT_DISTANCE } from '../src/systems/obstacles/planner.js';

const SEEDS = Number(process.argv[2]) || 4;
const METRES = Number(process.argv[3]) || 1200;
const SABOTAGE = process.argv.includes('--sabotage');
const SIGHT = process.argv.includes('--sight');
// Override the warning distance to probe how much margin there is (SIGHT_U=2 must find dead ends).
const SIGHT_U = Number(process.env.SIGHT_U) || SIGHT_DISTANCE;
const MARGIN = 0.05; // extra bird radius the route must clear by
const DT = 1 / 60;
const SUBSTEPS = 6; // decision every 0.1 s
const Y_CELL = 0.1;
const VY_CELL = 1.0;
const Y_MIN = WORLD.groundY;
const VY_MIN = PHYSICS.maxDiveSpeed;
const NY = Math.ceil((WORLD.ceilingY - Y_MIN) / Y_CELL) + 1;
const NV = Math.ceil((PHYSICS.maxRiseSpeed - VY_MIN) / VY_CELL) + 1;
const ACTIONS = [
  { flap: false, hold: false },
  { flap: true, hold: false },
  { flap: true, hold: true },
];
const R = PHYSICS.birdRadius + MARGIN;

const bird = { y: 0, vy: 0, lastVy: 0, pitch: 0, pitchVel: 0, roll: 0, rollVel: 0, accel: 0, diveAmt: 0, holding: false, sinceFlap: 99 };
const inputs = { holding: false, dive: false };

function searchSeed(seed) {
  const sim = createGameSim();
  sim.reset(seed);
  sim.phase = PHASE.RUNNING;
  if (SABOTAGE) {
    // A wall across the whole flight band: the search must report a dead end here.
    const w = sim.obstacles.acquire();
    Object.assign(w, { kind: 'block', shape: 'box', x: 60, y: 0.6, hw: 1, hh: 6, extent: 1, dyn: '' });
  }
  const near = [];

  // States: parallel arrays of (y, vy), plus a grid that keeps one state per cell.
  let ys = [WORLD.birdStartY];
  let vs = [0];
  const cell = new Int32Array(NY * NV);
  let stamp = 0;
  const nextY = [];
  const nextV = [];

  let x = 0;
  let t = 0;
  let maxStates = 0;
  let decisions = 0;
  while (x < METRES) {
    // Keep the track generated ahead of the search front, and gather what's near.
    sim.distance = sim.prevDistance = x;
    sim.phase = PHASE.RUNNING;
    sim.step(0);
    sim.events.length = 0;
    near.length = 0;
    for (const o of sim.obstacles.active) {
      if (o.x + o.extent < x - 3) sim.obstacles.release(o);
      else if (o.x - o.extent < x + 14) near.push(o);
    }
    for (const orb of sim.orbs.active) if (orb.x < x - 20) sim.orbs.release(orb);

    stamp++;
    nextY.length = 0;
    nextV.length = 0;
    for (let s = 0; s < ys.length; s++) {
      for (const a of ACTIONS) {
        bird.y = ys[s];
        bird.vy = vs[s];
        bird.lastVy = vs[s];
        bird.pitch = bird.pitchVel = bird.roll = bird.rollVel = bird.accel = bird.diveAmt = 0;
        bird.sinceFlap = 99;
        inputs.holding = a.hold;
        if (a.flap) applyFlap(bird);
        let px = x;
        let pt = t;
        let alive = true;
        for (let k = 0; k < SUBSTEPS && alive; k++) {
          stepFlight(bird, inputs, DT);
          px += speedAt(px) * DT;
          pt += DT;
          if (bird.y - R <= WORLD.groundY) {
            alive = false;
            break;
          }
          for (let i = 0; i < near.length; i++) {
            const o = near[i];
            if (o.dyn) applyTime(o, pt);
            if (Math.abs(o.x - px) <= o.extent + R && circleHitsObstacle(px, bird.y, R, o)) {
              alive = false;
              break;
            }
          }
        }
        if (!alive) continue;
        const iy = Math.min(NY - 1, Math.max(0, Math.round((bird.y - Y_MIN) / Y_CELL)));
        const iv = Math.min(NV - 1, Math.max(0, Math.round((bird.vy - VY_MIN) / VY_CELL)));
        const key = iy * NV + iv;
        if (cell[key] === stamp) continue; // keep the first state that lands here
        cell[key] = stamp;
        nextY.push(bird.y);
        nextV.push(bird.vy);
      }
    }
    // Advance the search front to where the surviving states now are.
    for (let k = 0; k < SUBSTEPS; k++) {
      x += speedAt(x) * DT;
      t += DT;
    }
    decisions++;
    if (nextY.length === 0) {
      const c = sim.track.corridors.find((k) => k.x1 > x - 1) ?? {};
      return { seed, ok: false, at: x, types: c.type, decisions, maxStates };
    }
    ys = nextY.slice();
    vs = nextV.slice();
    maxStates = Math.max(maxStates, ys.length);
  }
  return { seed, ok: true, at: x, decisions, maxStates, types: sim.track.stats.types };
}

/**
 * Advance a set of states one decision. Returns the surviving states (exact
 * trajectories, at most one per grid cell).
 */
function advance(ys, vs, x, t, near, cellStamp) {
  const nextY = [];
  const nextV = [];
  for (let s = 0; s < ys.length; s++) {
    for (const a of ACTIONS) {
      bird.y = ys[s];
      bird.vy = vs[s];
      bird.lastVy = vs[s];
      bird.pitch = bird.pitchVel = bird.roll = bird.rollVel = bird.accel = bird.diveAmt = 0;
      bird.sinceFlap = 99;
      inputs.holding = a.hold;
      if (a.flap) applyFlap(bird);
      let px = x;
      let pt = t;
      let alive = true;
      for (let k = 0; k < SUBSTEPS && alive; k++) {
        stepFlight(bird, inputs, DT);
        px += speedAt(px) * DT;
        pt += DT;
        if (bird.y - R <= WORLD.groundY) {
          alive = false;
          break;
        }
        for (let i = 0; i < near.length; i++) {
          const o = near[i];
          if (o.dyn) applyTime(o, pt);
          if (Math.abs(o.x - px) <= o.extent + R && circleHitsObstacle(px, bird.y, R, o)) {
            alive = false;
            break;
          }
        }
      }
      if (!alive) continue;
      const iy = Math.min(NY - 1, Math.max(0, Math.round((bird.y - Y_MIN) / Y_CELL)));
      const iv = Math.min(NV - 1, Math.max(0, Math.round((bird.vy - VY_MIN) / VY_CELL)));
      const key = iy * NV + iv;
      if (cellStamp.cell[key] === cellStamp.stamp) continue;
      cellStamp.cell[key] = cellStamp.stamp;
      nextY.push(bird.y);
      nextV.push(bird.vy);
    }
  }
  return [nextY, nextV];
}

/**
 * "Sight" mode: for every moving-hazard section of a seed's track, start the bird at EVERY
 * height (at rest) SIGHT_DISTANCE before the hazard and search for a surviving flap schedule
 * from each one separately. A narrow phone at top speed is the worst case for how little
 * warning the player gets.
 */
function sightSeed(seed) {
  const sim = createGameSim();
  sim.reset(seed);
  const MOVING = new Set(['geysers', 'spinner', 'boulders']);
  const seen = new Set();
  const stamp = { cell: new Int32Array(NY * NV), stamp: 0 };
  let sections = 0;
  const failures = [];
  for (let d = 0; d <= METRES; d += 2) {
    sim.distance = sim.prevDistance = d;
    sim.phase = PHASE.RUNNING;
    sim.step(0);
    sim.events.length = 0;
    for (const c of sim.track.corridors) {
      if (!MOVING.has(c.type) || seen.has(c.x0)) continue;
      seen.add(c.x0);
      const obs = [...sim.obstacles.active].filter((o) => o.x >= c.x0 - 0.5 && o.x <= c.x1 + 0.5);
      const first = Math.min(...obs.filter((o) => o.dyn).map((o) => o.x - o.extent));
      sections++;
      // Every starting height, at rest. (One extra height just under the ceiling and one just over the lava.)
      let dead = null;
      // ...falling fast, hovering, or climbing when the hazard first comes into view.
      const starts = [];
      for (let y0 = Y_MIN + R + 0.05; y0 <= WORLD.ceilingY; y0 += 0.2) for (const v0 of [-6, 0, 5]) starts.push([y0, v0]);
      for (const [y0, v0] of starts) {
        if (dead !== null) break;
        let ys = [y0];
        let vs = [v0];
        let x = first - SIGHT_U;
        let t = timeAtDistance(x);
        while (x < c.x1 + 0.8 && ys.length) {
          stamp.stamp++;
          const near = obs;
          [ys, vs] = advance(ys, vs, x, t, near, stamp);
          for (let k = 0; k < SUBSTEPS; k++) {
            x += speedAt(x) * DT;
            t += DT;
          }
        }
        if (!ys.length) dead = { toFixed: (n) => y0.toFixed(n), v: v0 };
      }
      if (dead !== null) failures.push(`${c.type} at ${Math.round(c.x0)} m from height ${dead.toFixed(2)} (vy ${dead.v})`);
    }
    for (const o of sim.obstacles.active) if (o.x + o.extent < d - 20) sim.obstacles.release(o);
    for (const o of sim.orbs.active) if (o.x < d - 20) sim.orbs.release(o);
  }
  return { seed, sections, failures };
}

if (SIGHT) {
  let total = 0;
  let allFailures = 0;
  const t1 = Date.now();
  for (let seed = 1; seed <= SEEDS; seed++) {
    const r = sightSeed(seed);
    total += r.sections;
    allFailures += r.failures.length;
    console.log(`seed ${seed}: ${r.sections} moving sections, ${r.failures.length} not survivable from some height` + (r.failures.length ? `: ${r.failures.slice(0, 3).join('; ')}` : ''));
  }
  console.log(`${total - allFailures}/${total} moving-hazard sections survivable from every height with ${SIGHT_U} u of warning (${((Date.now() - t1) / 1000).toFixed(0)}s)`);
  process.exit(allFailures ? 1 : 0);
}

let bad = 0;
const t0 = Date.now();
for (let seed = 1; seed <= SEEDS; seed++) {
  const r = searchSeed(seed);
  console.log(
    `seed ${seed}: ${r.ok ? 'survivable' : 'DEAD END'} to ${Math.round(r.at)} m` +
      ` (${r.decisions} decisions, up to ${r.maxStates} live states)` +
      (r.ok ? '' : ` near a ${r.types}`),
  );
  if (!r.ok) bad++;
}
console.log(`${SEEDS - bad}/${SEEDS} seeds have a surviving route to ${METRES} m (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
process.exit(bad ? 1 : 0);
