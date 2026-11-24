import { DYING_DURATION, WORLD } from '../physics/constants.js';
import { speedAt } from '../physics/speed.js';
import { circleGap, circleHitsObstacle } from '../physics/collision.js';
import { ObjectPool } from '../obstacles/ObjectPool.js';
import { computeScore, toMetres } from '../scoring/scoring.js';
import { GAME_EVENTS } from '../events/gameEvents.js';
import { createRng, randomSeed } from '../../utils/random.js';
import { JOURNEY_LENGTH, MILESTONES, WORLD_COUNT, worldsCompleted } from '../world/worlds.js';
import { PHASE } from '../game/createGameSim.js';
import { RUN } from './constants.js';
import { pressJump, stepRunner } from './physics.js';
import { createRunnerTrack, fillRunnerTrack, resetRunnerTrack } from './track.js';

/**
 * The ground-runner simulation (the v2 game): plain JavaScript, no React, no Three.js. It has the same outward shape as the flying
 * game's simulation (createGameSim.js), so the game loop, the HUD, the event routing, the world scenery and the headless tests drive
 * it the same way; only the rules differ:
 *  - she runs on the land (the floor of whichever world she is in), there is no lava;
 *  - TAP is a jump (HOLD keeps its full power, Down drops fast), and there is nothing to flap in mid-air;
 *  - the obstacles are ground obstacles she jumps, and pits she jumps across (track.js);
 *  - what stays the same: the run speed curve, the scoring, the five worlds and their milestones, the finish line, the events.
 *
 * It never reads an avatar or a game version: the store picks which simulation a version runs, and the avatar is only drawn.
 * `y` of the bird is the height of her FEET.
 */
const GLIDE_SPEED = 4.2; // after the finish line she eases to a jog while the ending plays
const FLAP_EVENT = Object.freeze({ type: GAME_EVENTS.FLAP }); // "flap" is the jump's event (sound, camera kick)
const START_EVENT = Object.freeze({ type: GAME_EVENTS.START });

function createObstacle() {
  return { kind: 'rock', look: 'rock', shape: 'box', x: 0, y: 0, z: 0, w: 1, h: 1, hw: 0, hh: 0, x0: 0, x1: 0, rot: 0, sx: 1, sy: 1, sz: 1, extent: 0, gap: Infinity, nm: false };
}
function createOrb() {
  return { x: 0, y: 0, phase: 0, missed: false };
}

export function createRunnerSim() {
  const rng = createRng(1);
  const obstacles = new ObjectPool(createObstacle, undefined, 48);
  const orbs = new ObjectPool(createOrb, undefined, 32);
  const items = new ObjectPool(() => ({}), undefined, 0); // no power-ups in the runner: kept so shared code can read an empty pool
  const track = createRunnerTrack();
  const pits = []; // the pits among the active obstacles (rebuilt as they come and go): where the land has a gap

  const builder = {
    block(look, x0, x1, h) {
      const o = obstacles.acquire();
      o.kind = look;
      o.look = look;
      o.shape = 'box';
      o.x = (x0 + x1) / 2;
      o.y = RUN.groundY + h / 2;
      o.z = rng.range(-0.15, 0.15);
      o.w = x1 - x0;
      o.h = h;
      // the collider sits slightly inside what is drawn (fairness), as the flying game's obstacles do
      o.hw = o.w / 2 - 0.05;
      o.hh = h / 2 - 0.04;
      o.x0 = x0;
      o.x1 = x1;
      o.rot = rng.range(-0.4, 0.4);
      o.sx = rng.range(0.92, 1.08);
      o.sy = rng.range(0.92, 1.06);
      o.sz = rng.range(0.9, 1.2);
      o.extent = o.w / 2;
      o.gap = Infinity;
      o.nm = false;
    },
    pit(x0, x1) {
      const o = obstacles.acquire();
      o.kind = 'pit';
      o.look = 'pit';
      o.shape = 'none';
      o.x = (x0 + x1) / 2;
      o.y = RUN.groundY;
      o.z = 0;
      o.w = x1 - x0;
      o.h = 0;
      o.hw = o.hh = 0;
      o.x0 = x0;
      o.x1 = x1;
      o.rot = 0;
      o.sx = o.sy = o.sz = 1;
      o.extent = o.w / 2;
      o.gap = Infinity;
      o.nm = true; // a pit is never a "near miss"
    },
    orb(x, y) {
      const orb = orbs.acquire();
      orb.x = x;
      orb.y = y;
      orb.phase = rng() * Math.PI * 2;
      orb.missed = false;
    },
  };

  const sim = {
    /** Which kind of simulation this is ('runner'); the flying game's has none. UI and loop code may branch on it. */
    kind: 'runner',
    phase: PHASE.READY,
    seed: 1,
    time: 0,
    distance: 0,
    prevDistance: 0,
    scoredDistance: 0,
    speed: WORLD.baseSpeed,
    orbsCollected: 0,
    orbStreak: 0,
    bestStreak: 0,
    nearMisses: 0,
    /** What ended the run: an obstacle look ('rock' | 'ice' | 'log') or 'pit'. */
    crashCause: null,
    milestonesDone: 0,
    completeTime: 0,
    // no power-ups here, but the HUD and the avatar layer read these
    magnetLeft: 0,
    shield: false,
    shieldLeft: 0,
    grace: 0,
    deathTime: 0,
    alpha: 1,
    /** The runner. `y` is the height of her feet; `idle` is true while she waits to start. */
    bird: { y: RUN.groundY, prevY: RUN.groundY, vy: 0, grounded: true, sinceGround: 0, buffer: 0, pitch: 0, spin: 0, sinceFlap: 99, dead: false, idle: true, speed: 0 },
    input: { holding: false, dive: false, flapQueued: false },
    fx: { fovKick: 0, shake: 0, lift: 0 },
    obstacles,
    orbs,
    items,
    track,
    events: [],

    get metres() {
      return toMetres(sim.phase === PHASE.RUNNING || sim.phase === PHASE.READY ? sim.distance : sim.scoredDistance);
    },
    get completed() {
      return sim.phase === PHASE.COMPLETE;
    },
    get score() {
      return computeScore(sim.metres, sim.orbsCollected);
    },
    results() {
      return {
        score: sim.score,
        distance: sim.metres,
        orbs: sim.orbsCollected,
        bestStreak: sim.bestStreak,
        nearMisses: sim.nearMisses,
        cause: sim.crashCause,
        completed: sim.phase === PHASE.COMPLETE,
        worlds: sim.phase === PHASE.COMPLETE ? WORLD_COUNT : worldsCompleted(sim.scoredDistance),
      };
    },

    reset(seed = randomSeed()) {
      sim.seed = seed;
      rng.reseed(seed);
      obstacles.releaseAll();
      orbs.releaseAll();
      pits.length = 0;
      sim.phase = PHASE.READY;
      sim.time = 0;
      sim.distance = sim.prevDistance = sim.scoredDistance = 0;
      sim.speed = WORLD.baseSpeed;
      sim.orbsCollected = 0;
      sim.orbStreak = sim.bestStreak = sim.nearMisses = 0;
      sim.crashCause = null;
      sim.milestonesDone = 0;
      sim.completeTime = 0;
      sim.deathTime = 0;
      sim.alpha = 1;
      const b = sim.bird;
      b.y = b.prevY = RUN.groundY;
      b.vy = b.pitch = b.spin = 0;
      b.grounded = true;
      b.sinceGround = 0;
      b.buffer = 0;
      b.sinceFlap = 99;
      b.dead = false;
      b.idle = true;
      b.speed = 0;
      sim.input.holding = sim.input.dive = sim.input.flapQueued = false;
      sim.fx.fovKick = sim.fx.shake = sim.fx.lift = 0;
      sim.events.length = 0;
      resetRunnerTrack(track);
      fillRunnerTrack(track, builder, 0, rng);
    },

    /** Jump input (the game calls it "flap"). The first press starts the run. */
    flap() {
      if (sim.phase === PHASE.READY) {
        sim.phase = PHASE.RUNNING;
        sim.bird.idle = false;
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
        b.y = RUN.groundY; // she waits on the land for the first press
        b.sinceFlap += dt;
        return;
      }
      if (sim.phase === PHASE.RUNNING) stepRunning(dt);
      else if (sim.phase === PHASE.COMPLETE) stepComplete(dt);
      else stepDying(dt);
    },

    renderDistance() {
      return sim.prevDistance + (sim.distance - sim.prevDistance) * sim.alpha;
    },
    renderBirdY() {
      return sim.bird.prevY + (sim.bird.y - sim.bird.prevY) * sim.alpha;
    },
  };

  /** Is there land under her feet at x? (false inside a pit, beyond its forgiving lips) */
  function landAt(x) {
    for (let i = 0; i < pits.length; i++) {
      const p = pits[i];
      if (x > p.x0 + RUN.pitLip && x < p.x1 - RUN.pitLip) return false;
    }
    return true;
  }
  sim.landAt = landAt;

  function collectPits() {
    pits.length = 0;
    for (const o of obstacles.active) if (o.kind === 'pit') pits.push(o);
  }

  function stepRunning(dt) {
    const b = sim.bird;
    if (sim.input.flapQueued) {
      sim.input.flapQueued = false;
      pressJump(b);
    }
    sim.speed = speedAt(sim.distance);
    b.speed = sim.speed;
    sim.distance += sim.speed * dt;
    fillRunnerTrack(track, builder, sim.distance, rng);
    collectPits();

    const bx = sim.distance;
    if (stepRunner(b, sim.input, dt, landAt(bx))) {
      sim.fx.fovKick += 0.5;
      sim.fx.lift = 1;
      sim.events.push(FLAP_EVENT);
    }
    if (b.y <= RUN.groundY - RUN.pitDeathDepth) {
      die('pit');
      return;
    }

    const behind = bx - WORLD.despawnBehind;
    const R = RUN.hitCircles[0].r;
    for (const o of obstacles.active) {
      if (o.x + o.extent < behind) {
        obstacles.release(o);
        continue;
      }
      if (o.kind === 'pit') continue; // a pit is the land giving way (handled above), not a collider
      const ahead = o.x - bx;
      const band = o.extent + R + RUN.nearMissGap;
      if (ahead > band) continue; // broad phase
      if (ahead < -band) {
        if (!o.nm && o.gap < RUN.nearMissGap) {
          o.nm = true;
          sim.nearMisses += 1;
          sim.events.push({ type: GAME_EVENTS.NEAR, x: o.x, y: b.y + 1 });
        }
        continue;
      }
      let gap = Infinity;
      for (const c of RUN.hitCircles) {
        if (circleHitsObstacle(bx + c.dx, b.y + c.dy, c.r, o)) {
          die(o.kind);
          return;
        }
        const g = circleGap(bx + c.dx, b.y + c.dy, c.r, o);
        if (g < gap) gap = g;
      }
      if (gap < o.gap) o.gap = gap;
    }

    const reachR = R + RUN.orbRadius;
    for (const orb of orbs.active) {
      const dx = orb.x - bx;
      if (dx < -WORLD.despawnBehind) {
        orbs.release(orb);
        continue;
      }
      if (dx < -reachR && !orb.missed) {
        orb.missed = true;
        sim.orbStreak = 0; // slipped past uncollected: the streak is broken
        continue;
      }
      if (dx > reachR) continue;
      let hit = false;
      for (const c of RUN.hitCircles) {
        const ox = orb.x - (bx + c.dx);
        const oy = orb.y - (b.y + c.dy);
        if (ox * ox + oy * oy < (c.r + RUN.orbRadius) ** 2) hit = true;
      }
      if (hit) {
        orbs.release(orb);
        sim.orbsCollected += 1;
        sim.orbStreak += 1;
        if (sim.orbStreak > sim.bestStreak) sim.bestStreak = sim.orbStreak;
        sim.fx.fovKick += 1.4;
        sim.events.push({ type: GAME_EVENTS.ORB, x: orb.x, y: orb.y, streak: sim.orbStreak });
      }
    }

    // Milestones and the finish line come last, so a crash in the same step always wins (as in the flying game).
    while (sim.milestonesDone < WORLD_COUNT - 1 && sim.distance >= MILESTONES[sim.milestonesDone].at) {
      const m = MILESTONES[sim.milestonesDone++];
      sim.events.push({ type: GAME_EVENTS.MILESTONE, index: m.index, at: m.at, world: m.world, name: m.name });
    }
    if (sim.distance >= JOURNEY_LENGTH) complete();
  }

  function complete() {
    sim.milestonesDone = WORLD_COUNT;
    sim.phase = PHASE.COMPLETE;
    sim.scoredDistance = JOURNEY_LENGTH;
    sim.completeTime = 0;
    sim.input.holding = sim.input.dive = sim.input.flapQueued = false;
    sim.events.push({ type: GAME_EVENTS.COMPLETE, ...sim.results() });
  }

  /** The ending: no input, no collisions, no new obstacles; she eases to a jog on the land. */
  function stepComplete(dt) {
    const b = sim.bird;
    sim.completeTime += dt;
    sim.speed += (GLIDE_SPEED - sim.speed) * (1 - Math.exp(-1.1 * dt));
    b.speed = sim.speed;
    sim.distance += sim.speed * dt;
    b.y = RUN.groundY;
    b.vy = 0;
    b.grounded = true;
    const behind = sim.distance - WORLD.despawnBehind;
    for (const o of obstacles.active) if (o.x + o.extent < behind) obstacles.release(o);
    for (const orb of orbs.active) if (orb.x < behind) orbs.release(orb);
  }

  function die(cause) {
    const b = sim.bird;
    sim.crashCause = cause;
    sim.phase = PHASE.DYING;
    sim.scoredDistance = sim.distance;
    sim.deathTime = 0;
    b.dead = true;
    if (cause !== 'pit') b.vy = Math.max(b.vy, 0) * 0.3 + 3; // knocked up a little before she drops
    sim.input.holding = sim.input.dive = sim.input.flapQueued = false;
    sim.fx.shake = 0.35;
    sim.events.push({ type: GAME_EVENTS.CRASH, x: sim.distance, y: b.y, cause });
  }

  function stepDying(dt) {
    const b = sim.bird;
    sim.speed *= Math.exp(-3.5 * dt); // the world slows to a stop
    sim.distance += sim.speed * dt;
    b.speed = sim.speed;
    const over = sim.crashCause === 'pit';
    b.vy = Math.max(b.vy + RUN.gravity * dt, RUN.maxFallSpeed);
    b.y += b.vy * dt;
    if (!over && b.y <= RUN.groundY) {
      b.y = RUN.groundY;
      b.vy = 0;
      b.grounded = true;
    }
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
