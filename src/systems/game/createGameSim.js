import { DYING_DURATION, PHYSICS, WORLD } from '../physics/constants.js';
import { applyFlap, stepFlight } from '../physics/flight.js';
import { circleHitsObstacle, clearanceToObstacle } from '../physics/collision.js';
import { ObjectPool } from '../obstacles/ObjectPool.js';
import { createTrack, fillTrack, resetTrack, speedAt } from '../obstacles/spawner.js';
import { BOULDER, RING, SPINNER, applyTime, fillRingNodes } from '../obstacles/dynamics.js';
import { computeScore, toMetres } from '../scoring/scoring.js';
import { GAME_EVENTS } from '../events/gameEvents.js';
import { createRng, randomSeed } from '../../utils/random.js';

/**
 * The whole game simulation as plain JavaScript: no React, no Three.js.
 * Advanced in fixed timesteps by useGameLoop (in the browser) or directly
 * by the headless tests. Renderers read its state every frame; feedback
 * systems consume `events`, which the loop drains after each frame.
 *
 * Coordinates: x is distance along the track. The bird's x always equals
 * `distance`; obstacles have fixed track x. Renderers draw at x - distance.
 */
export const PHASE = Object.freeze({ READY: 'ready', RUNNING: 'running', DYING: 'dying', OVER: 'over' });

const ORB_RADIUS = 0.35;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const FLAP_EVENT = Object.freeze({ type: GAME_EVENTS.FLAP });
const START_EVENT = Object.freeze({ type: GAME_EVENTS.START });

/** A pass counts as a near miss when the gap between bird and rock is under this (units). */
const NEAR_CLEARANCE = 0.3;
/** Clearance is tracked while the bird is within this distance of an obstacle's x-range. */
const NEAR_WINDOW = 0.3;
/** Minimum seconds between near-miss events, so a gate's two columns give one cue. */
const NEAR_COOLDOWN = 0.35;
/** Impact hit-stop: the world slows to this fraction for this many seconds after a crash. */
const HIT_STOP_TIME = 0.075;
const HIT_STOP_SCALE = 0.1;

function createObstacle() {
  return { kind: 'column', shape: 'box', x: 0, y: 0, z: 0, w: 1, h: 1, d: 1, hw: 0, hh: 0, cr: 0, r: 0, sx: 1, sy: 1, sz: 1, rot: 0, spin: 0, cap: 0, extent: 0, minClear: Infinity, nearDone: false, nearX: 0, nearY: 0, nearSide: 0,
    // Moving hazards and multi-circle colliders (see obstacles/dynamics.js).
    dyn: '', p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, arm: 0, landed: false, gone: false, landedSent: false,
    nodes: new Float32Array(20), nodeCount: 0, nr: 0, claimed: false, rr: 0 };
}
/** Clear everything a (re)used obstacle record may carry from its previous life. */
function freshObstacle(o) {
  o.minClear = Infinity;
  o.nearDone = false;
  o.dyn = '';
  o.arm = 0;
  o.landed = o.gone = o.landedSent = o.claimed = false;
  o.nodeCount = 0;
  o.nr = 0;
  o.rr = 0;
}
function createOrb() {
  return { x: 0, y: 0, phase: 0, kind: 0 };
}

function createBird() {
  return {
    y: WORLD.birdStartY, prevY: WORLD.birdStartY, vy: 0, lastVy: 0,
    pitch: 0, pitchVel: 0, roll: 0, rollVel: 0, accel: 0, diveAmt: 0, holding: false,
    spin: 0, sinceFlap: 99, dead: false,
  };
}

export function createGameSim() {
  const rng = createRng(1);
  const obstacles = new ObjectPool(createObstacle, undefined, 64);
  const orbs = new ObjectPool(createOrb, undefined, 32);
  const track = createTrack();

  /** Everything the current section proposal acquired, so a rejected one can be rolled back. */
  const built = { obs: [], orbs: [] };
  function acquireObstacle() {
    const o = obstacles.acquire();
    freshObstacle(o);
    built.obs.push(o);
    return o;
  }
  function acquireOrb(kind) {
    const orb = orbs.acquire();
    orb.kind = kind;
    orb.phase = rng() * Math.PI * 2;
    built.orbs.push(orb);
    return orb;
  }

  /** Pool-backed builder handed to obstacle patterns. */
  const builder = {
    built,
    begin() {
      built.obs.length = 0;
      built.orbs.length = 0;
    },
    mark() {
      return { o: built.obs.length, b: built.orbs.length };
    },
    rollbackTo(m) {
      while (built.obs.length > m.o) obstacles.release(built.obs.pop());
      while (built.orbs.length > m.b) orbs.release(built.orbs.pop());
    },
    rollback() {
      builder.rollbackTo({ o: 0, b: 0 });
    },
    geyser(x, w, topMin, topMax, period, sArrive, rising, tArrive) {
      const o = acquireObstacle();
      o.kind = 'geyser';
      o.dyn = 'geyser';
      o.shape = 'box';
      o.x = x;
      o.z = 0;
      o.w = w;
      o.d = w;
      o.hw = w * 0.4;
      o.extent = w / 2;
      o.rot = 0;
      o.cap = 0;
      // s(t) = 0.5 - 0.5 cos(omega (t - tArrive) + psi): choose psi so s = sArrive on arrival.
      const psi = Math.acos(clamp(1 - 2 * sArrive, -1, 1)) * (rising ? 1 : -1);
      o.p1 = psi;
      o.p2 = (2 * Math.PI) / period;
      o.p3 = tArrive;
      o.p4 = topMin;
      o.p5 = topMax;
      applyTime(o, tArrive);
    },
    boulder(x, r, yCross, tArrive) {
      const o = acquireObstacle();
      o.kind = 'boulder';
      o.dyn = 'boulder';
      o.shape = 'circle';
      o.x = x;
      o.z = 0;
      o.r = r;
      o.cr = r * 0.86;
      o.sx = o.sy = o.sz = 1;
      o.rot = rng() * Math.PI * 2;
      o.spin = rng.range(-2, 2);
      o.extent = r;
      o.cap = 0;
      o.p1 = BOULDER.startY;
      o.p2 = BOULDER.gravity;
      const fall = Math.sqrt((2 * (BOULDER.startY - yCross)) / BOULDER.gravity); // time to reach yCross
      o.p3 = tArrive - fall;
      applyTime(o, tArrive - fall - 1);
    },
    spinner(x, y, omega, angleArrive, tArrive) {
      const o = acquireObstacle();
      o.kind = 'spinner';
      o.dyn = 'spinner';
      o.shape = 'nodes';
      o.x = x;
      o.y = y;
      o.z = 0;
      o.nr = SPINNER.nodeRadius;
      o.nodeCount = SPINNER.offsets.length;
      o.extent = SPINNER.offsets[SPINNER.offsets.length - 1] + SPINNER.nodeRadius;
      o.r = o.extent;
      o.h = 2 * o.extent;
      o.cap = 0;
      o.p1 = angleArrive;
      o.p2 = omega;
      o.p3 = tArrive;
      applyTime(o, tArrive);
    },
    ring(x, y) {
      const o = acquireObstacle();
      o.kind = 'ring';
      o.shape = 'nodes';
      o.x = x;
      o.y = y;
      o.z = 0;
      o.nr = RING.nodeRadius;
      o.extent = RING.spread + RING.nodeRadius;
      o.r = RING.radius;
      o.h = 2 * (RING.radius + RING.nodeRadius);
      o.cap = 0;
      o.rr = RING.radius - RING.nodeRadius - 0.12; // how close to centre counts as "through"
      fillRingNodes(o, x, y);
    },
    gem(x, y) {
      const orb = acquireOrb(1);
      orb.x = x;
      orb.y = y;
    },
    column(cx, yBottom, yTop, w, cap) {
      const o = acquireObstacle();
      o.kind = 'column';
      o.shape = 'box';
      o.x = cx;
      o.y = (yBottom + yTop) / 2;
      o.z = 0;
      o.w = w;
      o.h = yTop - yBottom;
      o.d = w;
      o.hw = w * 0.4; // hexagonal column: slightly inside the visual for fairness
      o.hh = o.h / 2 - 0.06;
      o.rot = rng() * Math.PI;
      o.spin = 0;
      o.cap = cap;
      o.extent = w / 2;
    },
    block(x0, x1, yBottom, yTop, cap) {
      const o = acquireObstacle();
      o.kind = 'block';
      o.shape = 'box';
      o.x = (x0 + x1) / 2;
      o.y = (yBottom + yTop) / 2;
      o.z = 0;
      o.w = x1 - x0;
      o.h = yTop - yBottom;
      o.d = WORLD.obstacleDepth * 1.4;
      o.hw = o.w / 2 - 0.05;
      o.hh = o.h / 2 - 0.06;
      o.rot = 0;
      o.spin = 0;
      o.cap = cap;
      o.extent = o.w / 2;
    },
    rock(x, y, r) {
      const o = acquireObstacle();
      o.kind = 'rock';
      o.shape = 'circle';
      o.x = x;
      o.y = y;
      o.z = rng.range(-0.3, 0.3);
      o.r = r;
      o.cr = r * 0.86; // icosahedron faces sit inside the bounding sphere
      o.sx = rng.range(0.9, 1.15);
      o.sy = rng.range(0.85, 1.05);
      o.sz = rng.range(0.9, 1.15);
      o.rot = rng() * Math.PI * 2;
      o.spin = rng.range(-0.6, 0.6);
      o.cap = 0;
      o.extent = r;
    },
    orb(x, y) {
      const orb = acquireOrb(0);
      orb.x = x;
      orb.y = y;
    },
  };

  const sim = {
    phase: PHASE.READY,
    seed: 1,
    time: 0,
    distance: 0,
    prevDistance: 0,
    /** Distance at the moment of the crash; scoring freezes there. */
    scoredDistance: 0,
    speed: WORLD.baseSpeed,
    orbsCollected: 0,
    gemsCollected: 0,
    ringsPassed: 0,
    /** Seconds since the first flap: the clock every moving hazard runs on. */
    runTime: 0,
    deathTime: 0,
    /** Interpolation factor between the last two fixed steps (set by the loop). */
    alpha: 1,
    bird: createBird(),
    lastNearTime: -99,
    input: { holding: false, dive: false, flapQueued: false },
    /** Camera/feedback impulses, decayed every step. */
    fx: { fovKick: 0, shake: 0, lift: 0 },
    obstacles,
    orbs,
    track,
    /** Events produced since the last drain. */
    events: [],

    get metres() {
      return toMetres(sim.phase === PHASE.RUNNING || sim.phase === PHASE.READY ? sim.distance : sim.scoredDistance);
    },
    get score() {
      return computeScore(sim.metres, sim.orbsCollected, sim.gemsCollected, sim.ringsPassed);
    },
    results() {
      return {
        score: sim.score,
        distance: sim.metres,
        orbs: sim.orbsCollected,
        gems: sim.gemsCollected,
        rings: sim.ringsPassed,
      };
    },

    reset(seed = randomSeed()) {
      sim.seed = seed;
      rng.reseed(seed);
      obstacles.releaseAll();
      orbs.releaseAll();
      sim.phase = PHASE.READY;
      sim.time = 0;
      sim.distance = sim.prevDistance = sim.scoredDistance = 0;
      sim.speed = WORLD.baseSpeed;
      sim.orbsCollected = 0;
      sim.gemsCollected = 0;
      sim.ringsPassed = 0;
      sim.runTime = 0;
      sim.deathTime = 0;
      sim.alpha = 1;
      const b = sim.bird;
      Object.assign(b, createBird());
      sim.lastNearTime = -99;
      sim.input.holding = sim.input.dive = sim.input.flapQueued = false;
      sim.fx.fovKick = sim.fx.shake = sim.fx.lift = 0;
      sim.events.length = 0;
      resetTrack(track, WORLD.birdStartY);
      fillTrack(track, builder, 0, rng);
      for (const o of obstacles.active) if (o.dyn) applyTime(o, 0);
    },

    /** Flap input. The first flap starts the run. */
    flap() {
      if (sim.phase === PHASE.READY) {
        sim.phase = PHASE.RUNNING;
        sim.events.push(START_EVENT);
      }
      if (sim.phase === PHASE.RUNNING) sim.input.flapQueued = true;
    },
    setHolding(v) {
      sim.input.holding = v;
    },
    setDive(v) {
      sim.input.dive = v;
    },

    step(dt) {
      const b = sim.bird;
      b.prevY = b.y;
      sim.prevDistance = sim.distance;
      sim.time += dt;
      const decay = Math.exp(-6 * dt);
      sim.fx.fovKick *= decay;
      sim.fx.lift *= decay;
      sim.fx.shake *= Math.exp(-4.5 * dt);

      if (sim.phase === PHASE.READY) {
        b.y = WORLD.birdStartY + Math.sin(sim.time * 2.4) * 0.15;
        b.vy = Math.cos(sim.time * 2.4) * 0.36;
        b.pitch *= 0.9;
        b.pitchVel = b.roll = b.rollVel = b.accel = b.diveAmt = 0;
        b.lastVy = b.vy;
        b.sinceFlap += dt;
        return;
      }
      if (sim.phase === PHASE.RUNNING) stepRunning(dt);
      else stepDying(dt);
    },

    /** Interpolated values for smooth rendering between fixed steps. */
    renderDistance() {
      return sim.prevDistance + (sim.distance - sim.prevDistance) * sim.alpha;
    },
    renderBirdY() {
      return sim.bird.prevY + (sim.bird.y - sim.bird.prevY) * sim.alpha;
    },
  };

  function stepRunning(dt) {
    const b = sim.bird;
    if (sim.input.flapQueued) {
      sim.input.flapQueued = false;
      applyFlap(b);
      sim.fx.fovKick += 0.8;
      sim.fx.lift = 1;
      sim.events.push(FLAP_EVENT);
    }
    stepFlight(b, sim.input, dt);

    sim.speed = speedAt(sim.distance);
    sim.distance += sim.speed * dt;
    sim.runTime += dt;
    fillTrack(track, builder, sim.distance, rng);

    const bx = sim.distance;
    const R = PHYSICS.birdRadius;
    const behind = bx - WORLD.despawnBehind;

    // Ground is lava: touching it ends the run.
    if (b.y - R <= WORLD.groundY) {
      die('lava');
      return;
    }

    for (const o of obstacles.active) {
      if (o.x + o.extent < behind) {
        obstacles.release(o);
        continue;
      }
      if (o.dyn) {
        applyTime(o, sim.runTime);
        if (o.landed && !o.landedSent) {
          o.landedSent = true;
          sim.events.push({ type: GAME_EVENTS.LANDING, x: o.x, y: o.y });
        }
      }
      const dx = o.x - bx;
      // A fire ring pays out once, the moment the bird crosses it without having hit it.
      if (o.kind === 'ring' && !o.claimed && dx <= 0) {
        o.claimed = true;
        if (Math.abs(b.y - o.y) < o.rr) {
          sim.ringsPassed += 1;
          sim.fx.fovKick += 1.2;
          sim.events.push({ type: GAME_EVENTS.RING, x: o.x, y: o.y });
        }
      }
      const reachX = o.extent + R;
      if (Math.abs(dx) > reachX + NEAR_WINDOW) {
        // Just passed it: report a near miss once, then stop looking at it.
        if (dx < 0 && !o.nearDone) finishPass(o);
        continue;
      }
      // Hit decisions use only the exact collider test, as before.
      if (Math.abs(dx) <= reachX && circleHitsObstacle(bx, b.y, R, o)) {
        die('obstacle');
        return;
      }
      const clear = clearanceToObstacle(bx, b.y, R, o);
      if (clear < o.minClear) {
        o.minClear = clear;
        o.nearX = bx;
        o.nearY = b.y;
        o.nearSide = o.y >= b.y ? 1 : -1;
      }
    }

    const reach = R + ORB_RADIUS;
    for (const orb of orbs.active) {
      const dx = orb.x - bx;
      if (dx < -WORLD.despawnBehind) {
        orbs.release(orb);
        continue;
      }
      if (dx > reach) continue;
      const dy = orb.y - b.y;
      if (dx * dx + dy * dy < reach * reach) {
        // Released immediately, so it can never be collected twice.
        orbs.release(orb);
        const gem = orb.kind === 1;
        if (gem) sim.gemsCollected += 1;
        else sim.orbsCollected += 1;
        sim.fx.fovKick += gem ? 2 : 1.4;
        sim.events.push({ type: GAME_EVENTS.ORB, x: orb.x, y: orb.y, gem });
      }
    }
  }

  function finishPass(o) {
    o.nearDone = true;
    if (o.minClear >= NEAR_CLEARANCE || sim.time - sim.lastNearTime < NEAR_COOLDOWN) return;
    sim.lastNearTime = sim.time;
    sim.fx.fovKick += 0.5;
    sim.events.push({ type: GAME_EVENTS.NEAR_MISS, x: o.nearX, y: o.nearY, clearance: o.minClear, side: o.nearSide });
  }

  function die(cause) {
    const b = sim.bird;
    sim.phase = PHASE.DYING;
    sim.scoredDistance = sim.distance;
    sim.deathTime = 0;
    b.dead = true;
    b.vy = Math.max(b.vy, 0) * 0.3 + 4; // knocked upward before falling
    sim.input.holding = sim.input.dive = sim.input.flapQueued = false;
    sim.fx.shake = 0.35;
    sim.events.push({ type: GAME_EVENTS.CRASH, x: sim.distance, y: b.y, cause, speed: sim.speed });
  }

  function stepDying(realDt) {
    const b = sim.bird;
    // Hit-stop: the first instant after impact plays in near-freeze, which is
    // what makes a crash feel like it connected. Timers keep real time.
    const dt = sim.phase === PHASE.DYING && sim.deathTime < HIT_STOP_TIME ? realDt * HIT_STOP_SCALE : realDt;
    // World decelerates to a stop; the bird tumbles to the ground.
    sim.speed *= Math.exp(-3.5 * dt);
    sim.distance += sim.speed * dt;
    const floor = WORLD.groundY + PHYSICS.birdRadius;
    b.vy = Math.max(b.vy + PHYSICS.gravity * dt, -14);
    b.y += b.vy * dt;
    if (b.y < floor) {
      b.y = floor;
      b.vy = Math.abs(b.vy) > 2 ? -b.vy * 0.3 : 0;
    }
    const grounded = b.y <= floor + 0.01 && b.vy === 0;
    b.spin += dt * (grounded ? 0 : -9) * Math.max(0.2, 1 - sim.deathTime);
    b.sinceFlap += dt;

    if (sim.phase === PHASE.DYING) {
      sim.deathTime += realDt;
      if (sim.deathTime >= DYING_DURATION) {
        sim.phase = PHASE.OVER;
        sim.events.push({ type: GAME_EVENTS.OVER, ...sim.results() });
      }
    }
  }

  sim.reset(1);
  return sim;
}
