import { DYING_DURATION, PHYSICS, POWERUPS, SCORING, WORLD } from '../physics/constants.js';
import { applyFlap, stepFlight } from '../physics/flight.js';
import { circleHitsObstacle, clearanceToObstacle } from '../physics/collision.js';
import { ObjectPool } from '../obstacles/ObjectPool.js';
import { createTrack, fillTrack, resetTrack, speedAt } from '../obstacles/spawner.js';
import { computeScore, streakMultiplier, toMetres } from '../scoring/scoring.js';
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
const FLAP_EVENT = Object.freeze({ type: GAME_EVENTS.FLAP });
const START_EVENT = Object.freeze({ type: GAME_EVENTS.START });

function createObstacle() {
  return {
    kind: 'column',
    shape: 'box',
    x: 0,
    y: 0,
    z: 0,
    w: 1,
    h: 1,
    d: 1,
    hw: 0,
    hh: 0,
    cr: 0,
    r: 0,
    sx: 1,
    sy: 1,
    sz: 1,
    rot: 0,
    spin: 0,
    cap: 0,
    extent: 0,
    /** Closest approach so far (near-miss tracking) and whether the bird has cleared it. */
    gap: Infinity,
    passed: false,
  };
}
function createOrb() {
  return { x: 0, y: 0, phase: 0 };
}
function createPowerup() {
  return { type: 'shield', x: 0, y: 0, phase: 0 };
}

export function createGameSim() {
  const rng = createRng(1);
  const obstacles = new ObjectPool(createObstacle, undefined, 64);
  const orbs = new ObjectPool(createOrb, undefined, 32);
  const powerups = new ObjectPool(createPowerup, undefined, 8);
  const track = createTrack();

  /** Pool-backed builder handed to obstacle patterns. */
  const builder = {
    column(cx, yBottom, yTop, w, cap) {
      const o = obstacles.acquire();
      o.gap = Infinity;
      o.passed = false;
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
      const o = obstacles.acquire();
      o.gap = Infinity;
      o.passed = false;
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
      const o = obstacles.acquire();
      o.gap = Infinity;
      o.passed = false;
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
    powerup(x, y, type) {
      const p = powerups.acquire();
      p.type = type;
      p.x = x;
      p.y = y;
      p.phase = rng() * Math.PI * 2;
    },
    orb(x, y) {
      const orb = orbs.acquire();
      orb.x = x;
      orb.y = y;
      orb.phase = rng() * Math.PI * 2;
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
    /** Near-miss bonus points, count, current streak, and the sim time of the last near miss. */
    bonus: 0,
    nearMisses: 0,
    streak: 0,
    lastNearMissAt: -99,
    deathTime: 0,
    /** Interpolation factor between the last two fixed steps (set by the loop). */
    alpha: 1,
    bird: {
      y: WORLD.birdStartY,
      prevY: WORLD.birdStartY,
      vy: 0,
      pitch: 0,
      spin: 0,
      sinceFlap: 99,
      dead: false,
    },
    input: { holding: false, dive: false, flapQueued: false },
    /** Camera/feedback impulses, decayed every step. */
    fx: { fovKick: 0, shake: 0, lift: 0 },
    obstacles,
    orbs,
    powerups,
    /** Active power-ups: shield is a flag, the rest are seconds remaining. invuln follows a shield hit. */
    power: { shield: false, magnet: 0, slow: 0, invuln: 0 },
    track,
    /** Events produced since the last drain. */
    events: [],

    get metres() {
      return toMetres(
        sim.phase === PHASE.RUNNING || sim.phase === PHASE.READY ? sim.distance : sim.scoredDistance,
      );
    },
    get score() {
      return computeScore(sim.metres, sim.orbsCollected, sim.bonus);
    },
    results() {
      return { score: sim.score, distance: sim.metres, orbs: sim.orbsCollected, nearMisses: sim.nearMisses };
    },

    reset(seed = randomSeed()) {
      sim.seed = seed;
      rng.reseed(seed);
      obstacles.releaseAll();
      orbs.releaseAll();
      powerups.releaseAll();
      const pw = sim.power;
      pw.shield = false;
      pw.magnet = pw.slow = pw.invuln = 0;
      sim.phase = PHASE.READY;
      sim.time = 0;
      sim.distance = sim.prevDistance = sim.scoredDistance = 0;
      sim.speed = WORLD.baseSpeed;
      sim.orbsCollected = 0;
      sim.bonus = sim.nearMisses = sim.streak = 0;
      sim.lastNearMissAt = -99;
      sim.deathTime = 0;
      sim.alpha = 1;
      const b = sim.bird;
      b.y = b.prevY = WORLD.birdStartY;
      b.vy = b.pitch = b.spin = 0;
      b.sinceFlap = 99;
      b.dead = false;
      sim.input.holding = sim.input.dive = sim.input.flapQueued = false;
      sim.fx.fovKick = sim.fx.shake = sim.fx.lift = 0;
      sim.events.length = 0;
      resetTrack(track, WORLD.birdStartY);
      fillTrack(track, builder, 0, rng);
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

    const pw = sim.power;
    pw.magnet = Math.max(0, pw.magnet - dt);
    pw.slow = Math.max(0, pw.slow - dt);
    pw.invuln = Math.max(0, pw.invuln - dt);

    sim.speed = speedAt(sim.distance) * (pw.slow > 0 ? POWERUPS.slowFactor : 1);
    sim.distance += sim.speed * dt;
    fillTrack(track, builder, sim.distance, rng);

    const bx = sim.distance;
    const R = PHYSICS.birdRadius;
    const behind = bx - WORLD.despawnBehind;

    // Ground is lava: touching it ends the run.
    if (b.y - R <= WORLD.groundY) {
      if (pw.invuln <= 0 && !absorbHit()) {
        die();
        return;
      }
      // The shield bounces the bird off the lava.
      b.y = WORLD.groundY + R + 0.05;
      b.vy = 7;
    }

    for (const o of obstacles.active) {
      if (o.x + o.extent < behind) {
        obstacles.release(o);
        continue;
      }
      const dx = Math.abs(o.x - bx);
      if (dx > o.extent + R + SCORING.nearMissMargin) continue; // broad phase
      if (dx <= o.extent + R && circleHitsObstacle(bx, b.y, R, o)) {
        if (pw.invuln <= 0 && !absorbHit()) {
          die();
          return;
        }
        o.passed = true; // a shielded hit is not a "close call"
        continue;
      }
      trackNearMiss(o, bx, b.y, R);
    }

    const reach = R + ORB_RADIUS;
    const magnetOn = pw.magnet > 0;
    for (const orb of orbs.active) {
      if (magnetOn) attract(orb, bx, b.y, dt);
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
        sim.orbsCollected += 1;
        sim.fx.fovKick += 1.4;
        sim.events.push({ type: GAME_EVENTS.ORB, x: orb.x, y: orb.y });
      }
    }

    collectPowerups(bx, b.y, R);
  }

  /** Pulls an orb toward the bird while the magnet is active. */
  function attract(orb, bx, by, dt) {
    const dx = bx - orb.x;
    const dy = by - orb.y;
    const d = Math.hypot(dx, dy);
    if (d > POWERUPS.magnetRange || d < 0.001) return;
    const step = Math.min(d, POWERUPS.magnetSpeed * dt);
    orb.x += (dx / d) * step;
    orb.y += (dy / d) * step;
  }

  /** A hit the shield can absorb. Returns true if it did (the run continues). */
  function absorbHit() {
    if (!sim.power.shield) return false;
    sim.power.shield = false;
    sim.power.invuln = POWERUPS.invulnDuration;
    sim.fx.shake = 0.25;
    sim.events.push({ type: GAME_EVENTS.SHIELD_BREAK, x: sim.distance, y: sim.bird.y });
    return true;
  }

  function collectPowerups(bx, by, R) {
    const reach = R + POWERUPS.pickupRadius;
    for (const p of powerups.active) {
      const dx = p.x - bx;
      if (dx < -WORLD.despawnBehind) {
        powerups.release(p);
        continue;
      }
      if (dx > reach) continue;
      const dy = p.y - by;
      if (dx * dx + dy * dy >= reach * reach) continue;
      powerups.release(p);
      const pw = sim.power;
      if (p.type === 'shield') pw.shield = true;
      else if (p.type === 'magnet') pw.magnet = POWERUPS.magnetDuration;
      else pw.slow = POWERUPS.slowDuration;
      sim.fx.fovKick += 1.2;
      sim.events.push({ type: GAME_EVENTS.POWERUP, kind: p.type, x: p.x, y: p.y });
    }
  }

  /** Tracks the closest approach to an obstacle; pays out once the bird has cleared it. */
  function trackNearMiss(o, bx, by, R) {
    if (o.passed) return;
    const gap = clearanceToObstacle(bx, by, R, o);
    if (gap < o.gap) o.gap = gap;
    if (bx <= o.x + o.extent + R) return; // still alongside it
    o.passed = true;
    if (o.gap >= SCORING.nearMissMargin) return;
    sim.streak = sim.time - sim.lastNearMissAt <= SCORING.streakWindow ? sim.streak + 1 : 1;
    sim.lastNearMissAt = sim.time;
    sim.nearMisses += 1;
    const points = SCORING.nearMissPoints * streakMultiplier(sim.streak);
    sim.bonus += points;
    sim.fx.fovKick += 0.6;
    sim.events.push({ type: GAME_EVENTS.NEAR_MISS, x: bx, y: by, streak: sim.streak, points });
  }

  function die() {
    const b = sim.bird;
    sim.phase = PHASE.DYING;
    sim.scoredDistance = sim.distance;
    sim.deathTime = 0;
    b.dead = true;
    b.vy = Math.max(b.vy, 0) * 0.3 + 4; // knocked upward before falling
    sim.input.holding = sim.input.dive = sim.input.flapQueued = false;
    sim.fx.shake = 0.35;
    sim.events.push({ type: GAME_EVENTS.CRASH, x: sim.distance, y: b.y });
  }

  function stepDying(dt) {
    const b = sim.bird;
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
      sim.deathTime += dt;
      if (sim.deathTime >= DYING_DURATION) {
        sim.phase = PHASE.OVER;
        sim.events.push({ type: GAME_EVENTS.OVER, ...sim.results() });
      }
    }
  }

  sim.reset(1);
  return sim;
}
