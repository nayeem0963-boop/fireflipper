import { DYING_DURATION, PHYSICS, POWERUPS, SCORING, WORLD } from '../physics/constants.js';
import { applyFlap, stepFlight } from '../physics/flight.js';
import { circleHitsObstacle, clearanceToObstacle } from '../physics/collision.js';
import { ObjectPool } from '../obstacles/ObjectPool.js';
import { createTrack, fillTrack, resetTrack, speedAt } from '../obstacles/spawner.js';
import { computeScore, streakMultiplier, toMetres } from '../scoring/scoring.js';
import { GAME_EVENTS } from '../events/gameEvents.js';
import { createRng, randomSeed } from '../../utils/random.js';
import { DYN, animate } from '../obstacles/dynamics.js';

/**
 * The whole game simulation as plain JavaScript: no React, no Three.js.
 * Advanced in fixed timesteps by useGameLoop (in the browser) or directly
 * by the headless tests. Renderers read its state every frame; feedback
 * systems consume `events`, which the loop drains after each frame.
 *
 * Coordinates: x is distance along the track. The bird's x always equals
 * `distance`; obstacles have fixed track x. Renderers draw at x - distance.
 */
/** Input codes stored in the replay log (see sim.inputLog). */
export const INPUT = Object.freeze({ FLAP: 0, HOLD_ON: 1, HOLD_OFF: 2, DIVE_ON: 3, DIVE_OFF: 4 });
/** The log stops growing past this many entries (a run that long is not submittable). */
export const MAX_LOG_LENGTH = 40000;

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
    /** Dynamic behaviour: 0 static, 1 swinging gate edge, 2 geyser. See animate(). */
    dyn: 0,
    /** Collidable right now (a geyser is harmless while charging or resting). */
    live: true,
    /** 0..1 render hint: how hot a geyser is (telegraph glow). */
    glow: 0,
    edge0: 0,
    farY: 0,
    side: 1,
    amp: 0,
    freq: 0,
    period: 0,
    maxH: 0,
    /** Phase offset into the motion: radians for a swinging gate, seconds for a geyser. */
    offset: 0,
    /** Falling rock: hang height, total drop to the bird's crossing point, trigger distance. */
    y0: 0,
    drop: 0,
    trigger: 0,
    /** Spinning blade: direction (radians) and half length. */
    angle: 0,
    hl: 0,
    /** Falling rock has hit the ground (shattering), whether that was announced, and render scale 1 -> 0. */
    landed: false,
    announced: false,
    fade: 1,
  };
}
function createOrb() {
  return { x: 0, y: 0, phase: 0 };
}
function createWind() {
  return { x0: 0, x1: 0, accel: 0 };
}
function createPowerup() {
  return { type: 'shield', x: 0, y: 0, phase: 0 };
}

export function createGameSim() {
  const rng = createRng(1);
  const obstacles = new ObjectPool(createObstacle, undefined, 64);
  const orbs = new ObjectPool(createOrb, undefined, 32);
  const powerups = new ObjectPool(createPowerup, undefined, 8);
  const winds = new ObjectPool(createWind, undefined, 8);
  const track = createTrack();

  /** Clears per-run state on a pooled obstacle record. */
  function reset(o) {
    o.gap = Infinity;
    o.passed = false;
    o.dyn = 0;
    o.live = true;
    o.glow = 0;
    o.landed = false;
    o.announced = false;
    o.fade = 1;
  }

  /** Pool-backed builder handed to obstacle patterns. */
  const builder = {
    column(cx, yBottom, yTop, w, cap) {
      const o = obstacles.acquire();
      reset(o);
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
      reset(o);
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
    /**
     * A gate whose opening swings up and down: both columns share one sine wave, so the gap keeps its
     * height and only its position moves. `freq` is in cycles per second.
     */
    swingGate(cx, w, center, gap, amp, freq, phase) {
      for (const side of [-1, 1]) {
        const o = obstacles.acquire();
        reset(o);
        o.kind = 'column';
        o.shape = 'box';
        o.x = cx;
        o.z = 0;
        o.w = w;
        o.d = w;
        o.hw = w * 0.4;
        o.rot = rng() * Math.PI;
        o.spin = 0;
        o.cap = -side; // glow on the end facing the gap
        o.extent = w / 2;
        o.dyn = DYN.SWING;
        o.side = side;
        o.edge0 = center + (side * gap) / 2;
        o.farY = side < 0 ? WORLD.groundY - 1.5 : WORLD.obstacleTopY;
        o.amp = amp;
        o.freq = freq;
        o.offset = phase;
        animate(o, 0, sim.distance);
      }
    },
    /** A lava geyser vent on the ground: quiet, then a telegraphed eruption up to `maxH`, on a cycle. */
    geyser(cx, w, maxH, period, phaseSeconds) {
      const o = obstacles.acquire();
      reset(o);
      o.kind = 'geyser';
      o.shape = 'box';
      o.x = cx;
      o.z = 0;
      o.w = w;
      o.d = w;
      o.hw = w * 0.4;
      o.rot = 0;
      o.spin = 0;
      o.cap = 0;
      o.extent = w / 2;
      o.dyn = DYN.GEYSER;
      o.maxH = maxH;
      o.period = period;
      o.offset = phaseSeconds;
      animate(o, 0, sim.distance);
    },
    /**
     * A rock that hangs above the ceiling and falls when the bird gets within `trigger` units. At the moment the
     * bird crosses it the rock is at y0 - drop; `y0` and `drop` are chosen by the pattern so a lane stays clear.
     */
    rockfall(x, r, y0, drop, trigger) {
      const o = obstacles.acquire();
      reset(o);
      o.kind = 'rock';
      o.shape = 'circle';
      o.x = x;
      o.z = 0;
      o.r = r;
      o.cr = r * 0.86;
      o.sx = o.sy = o.sz = 1;
      o.rot = rng() * Math.PI * 2;
      o.spin = rng.range(-0.8, 0.8);
      o.cap = 0;
      o.extent = r;
      o.dyn = DYN.ROCKFALL;
      o.y0 = y0;
      o.drop = drop;
      o.trigger = trigger;
      o.y = y0;
      animate(o, 0, sim.distance);
    },
    /**
     * A spinning blade pivoting at (cx, cy): a capsule of half length `hl` and half thickness `hw`
     * turning at `omega` rad/s from angle `phase`.
     */
    spinner(cx, cy, hl, hw, omega, phase) {
      const o = obstacles.acquire();
      reset(o);
      o.kind = 'spinner';
      o.shape = 'bar';
      o.x = cx;
      o.y = cy;
      o.z = 0;
      o.hl = hl;
      o.hw = hw;
      o.w = o.h = 2 * (hl + hw); // the disc it sweeps (used for the portrait edge warning)
      o.d = 0.6;
      o.rot = 0;
      o.spin = 0;
      o.cap = 0;
      o.extent = hl + hw;
      o.dyn = DYN.SPINNER;
      o.freq = omega;
      o.offset = phase;
      animate(o, 0, sim.distance);
    },
    /** A thin beam spanning x0..x1 whose height sweeps up and down around `y` by +-`amp`. */
    scanner(x0, x1, y, amp, freq, phase) {
      const o = obstacles.acquire();
      reset(o);
      o.kind = 'beam';
      o.shape = 'box';
      o.x = (x0 + x1) / 2;
      o.y = y;
      o.z = 0;
      o.w = x1 - x0;
      o.h = 0.22;
      o.d = 0.6;
      o.hw = o.w / 2 - 0.1;
      o.hh = 0.11;
      o.rot = 0;
      o.spin = 0;
      o.cap = 0;
      o.extent = o.w / 2;
      o.dyn = DYN.SCAN;
      o.edge0 = y;
      o.amp = amp;
      o.freq = freq;
      o.offset = phase;
      animate(o, 0, sim.distance);
    },
    /** An air current: while the bird is between x0 and x1 it gets a vertical push (see WIND). */
    wind(x0, x1, accel) {
      const w = winds.acquire();
      w.x0 = x0;
      w.x1 = x1;
      w.accel = accel;
    },
    rock(x, y, r) {
      const o = obstacles.acquire();
      reset(o);
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
    /** Fixed steps taken since reset. Inputs are logged against it for replays. */
    tick: 0,
    /** Flat replay log [tick, inputCode, tick, inputCode, ...] of player inputs this run. */
    inputLog: [],
    logOverflow: false,
    distance: 0,
    prevDistance: 0,
    /** Distance at the moment of the crash; scoring freezes there. */
    scoredDistance: 0,
    speed: WORLD.baseSpeed,
    orbsCollected: 0,
    /** How the run ended: { cause: 'lava' | 'obstacle', kind } (for analytics and balance tooling). */
    death: null,
    /** Near-miss bonus points, count, current streak, and the sim time of the last near miss. */
    bonus: 0,
    nearMisses: 0,
    streak: 0,
    lastNearMissAt: -99,
    deathTime: 0,
    /** Interpolation factor between the last two fixed steps (set by the loop). */
    alpha: 1,
    /** Seconds since the first flap; drives moving obstacles so they are identical in every replay. */
    runTime: 0,
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
    winds,
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
      winds.releaseAll();
      const pw = sim.power;
      pw.shield = false;
      pw.magnet = pw.slow = pw.invuln = 0;
      sim.phase = PHASE.READY;
      sim.time = 0;
      sim.tick = 0;
      sim.runTime = 0;
      sim.inputLog.length = 0;
      sim.logOverflow = false;
      sim.distance = sim.prevDistance = sim.scoredDistance = 0;
      sim.speed = WORLD.baseSpeed;
      sim.orbsCollected = 0;
      sim.death = null;
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
      record(INPUT.FLAP);
      if (sim.phase === PHASE.READY) {
        sim.phase = PHASE.RUNNING;
        sim.events.push(START_EVENT);
      }
      if (sim.phase === PHASE.RUNNING) sim.input.flapQueued = true;
    },
    setHolding(v) {
      if (v !== sim.input.holding) record(v ? INPUT.HOLD_ON : INPUT.HOLD_OFF);
      sim.input.holding = v;
    },
    setDive(v) {
      if (v !== sim.input.dive) record(v ? INPUT.DIVE_ON : INPUT.DIVE_OFF);
      sim.input.dive = v;
    },

    step(dt) {
      sim.tick += 1;
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

  /** Logs a player input (only while the run is live) so the server can replay and verify it. */
  function record(code) {
    if (sim.phase !== PHASE.READY && sim.phase !== PHASE.RUNNING) return;
    if (sim.inputLog.length >= MAX_LOG_LENGTH) {
      sim.logOverflow = true;
      return;
    }
    sim.inputLog.push(sim.tick, code);
  }

  function stepRunning(dt) {
    const b = sim.bird;
    sim.runTime += dt;
    if (sim.input.flapQueued) {
      sim.input.flapQueued = false;
      applyFlap(b);
      sim.fx.fovKick += 0.8;
      sim.fx.lift = 1;
      sim.events.push(FLAP_EVENT);
    }
    stepFlight(b, sim.input, dt, windAt(sim.distance));

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
        die('lava', 'lava');
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
      if (o.dyn) animate(o, sim.runTime, bx);
      if (o.landed && !o.announced) {
        // A falling rock just hit the ground: a thud and some dust, felt a little if it is close.
        o.announced = true;
        sim.events.push({ type: GAME_EVENTS.ROCK_IMPACT, x: o.x, y: o.y });
        if (Math.abs(o.x - bx) < 14) sim.fx.shake = Math.max(sim.fx.shake, 0.12);
      }
      if (!o.live) continue; // e.g. a geyser that is charging or resting
      const dx = Math.abs(o.x - bx);
      if (dx > o.extent + R + SCORING.nearMissMargin) continue; // broad phase
      if (dx <= o.extent + R && circleHitsObstacle(bx, b.y, R, o)) {
        if (pw.invuln <= 0 && !absorbHit()) {
          die('obstacle', o.kind);
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

  /** Total vertical push from any air current the bird is in at track position `x`. */
  function windAt(x) {
    let accel = 0;
    for (const w of winds.active) {
      if (x > w.x1 + WORLD.despawnBehind) winds.release(w);
      else if (x >= w.x0 && x <= w.x1) accel += w.accel;
    }
    return accel;
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

  function die(cause, kind) {
    const b = sim.bird;
    sim.phase = PHASE.DYING;
    sim.death = { cause, kind };
    sim.scoredDistance = sim.distance;
    sim.deathTime = 0;
    b.dead = true;
    b.vy = Math.max(b.vy, 0) * 0.3 + 4; // knocked upward before falling
    sim.input.holding = sim.input.dive = sim.input.flapQueued = false;
    sim.fx.shake = 0.35;
    sim.fx.fovKick += 2; // a punch-in on impact
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
