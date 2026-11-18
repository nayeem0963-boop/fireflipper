/**
 * Headless gameplay tests. Run with: npm run test:sim
 * Exercises the pure simulation (no browser, no WebGL).
 */
import { createGameSim, PHASE } from '../src/systems/game/createGameSim.js';
import { circleIntersectsBox, circleIntersectsCircle, circleHitsObstacle, clearanceToObstacle } from '../src/systems/physics/collision.js';
import { createStepper } from '../src/systems/game/fixedStep.js';
import { createRng } from '../src/utils/random.js';
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


// ---------------------------------------------------------------- flight feel (phase 1)
const freeSim = (seed = 3) => {
  const s = createGameSim();
  s.reset(seed);
  s.obstacles.releaseAll();
  s.orbs.releaseAll();
  s.track.nextX = 1e9;
  return s;
};

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
