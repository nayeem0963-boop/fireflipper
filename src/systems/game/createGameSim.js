import { DYING_DURATION, PHYSICS, WORLD } from '../physics/constants.js';
import { applyFlap, stepFlight } from '../physics/flight.js';
import { DYNAMIC_INSET, HAZARDS, createHazardFx, createObstacleFx, hazardsAt, obstacleHazard } from '../hazards/biomeHazards.js';
import { circleGap, circleHitsObstacle } from '../physics/collision.js';
import { ObjectPool } from '../obstacles/ObjectPool.js';
import { archPolys, columnPolys, hash01, ledgePolys, pickLook, poleInstances, poleReach, polysExtent, rockKit } from '../obstacles/rockShapes.js';
import { createTrack, fillTrack, resetTrack, speedAt } from '../obstacles/spawner.js';
import { computeScore, toMetres } from '../scoring/scoring.js';
import { GAME_EVENTS } from '../events/gameEvents.js';
import { createRng, randomSeed } from '../../utils/random.js';
import { JOURNEY_LENGTH, MILESTONES, WORLD_COUNT, worldsCompleted } from '../world/worlds.js';
import { GRACE_S, ITEM_RADIUS, MAGNET_PULL, MAGNET_RANGE, MAGNET_S, SHIELD_S } from '../powerups/powerups.js';
import { FLIERS, SLOTS as FLIER_SLOTS, flierHits, flierPlace, flierRescueY } from '../fliers/fliers.js';

/**
 * The whole game simulation as plain JavaScript: no React, no Three.js.
 * Advanced in fixed timesteps by useGameLoop (in the browser) or directly
 * by the headless tests. Renderers read its state every frame; feedback
 * systems consume `events`, which the loop drains after each frame.
 *
 * Coordinates: x is distance along the track. The bird's x always equals
 * `distance`; obstacles have fixed track x. Renderers draw at x - distance.
 */
export const PHASE = Object.freeze({ READY: 'ready', RUNNING: 'running', DYING: 'dying', OVER: 'over', COMPLETE: 'complete' });

/** The bird's glide after the finish line (the ending): speed it eases to (m/s) and the cruising height it settles at. */
const GLIDE_SPEED = 4.2;
const GLIDE_Y = 1.2;

const ORB_RADIUS = 0.35;
/** Passing an obstacle with less clearance than this (world units) counts as a near miss. */
const NEAR_MISS_GAP = 0.3;
const FLAP_EVENT = Object.freeze({ type: GAME_EVENTS.FLAP });
const START_EVENT = Object.freeze({ type: GAME_EVENTS.START });

function createObstacle() {
  return { kind: 'column', shape: 'box', x: 0, y: 0, z: 0, w: 1, h: 1, d: 1, hw: 0, hh: 0, cr: 0, r: 0, sx: 1, sy: 1, sz: 1, rot: 0, spin: 0, cap: 0, extent: 0, gap: Infinity, nm: false, kit: null, look: null, polys: null, draw: null, dy: 0, solid: true, pulse: 0, rumble: 0, dyn: false };
}
function createOrb() {
  return { x: 0, y: 0, phase: 0, missed: false };
}
/** A power-up item on the track: its kind ('magnet' | 'shield') and place; collected (and released) by the same kind of circle test as an orb. */
function createItem() {
  return { kind: 'magnet', x: 0, y: 0, phase: 0 };
}

export function createGameSim() {
  const rng = createRng(1);
  const obstacles = new ObjectPool(createObstacle, undefined, 64);
  const orbs = new ObjectPool(createOrb, undefined, 32);
  const items = new ObjectPool(createItem, undefined, 8);
  const track = createTrack();
  const HZ_OB = createObstacleFx(); // scratch for the obstacle hazards, reused
  const FP = { x: 0, dx: 0, y: 0 }; // scratch for a flying hazard's place, reused

  /** Pool-backed builder handed to obstacle patterns. */
  const builder = {
    column(cx, yBottom, yTop, w, cap) {
      const o = obstacles.acquire();
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
      o.gap = Infinity;
      o.nm = false;
      o.dy = 0;
      o.solid = true;
      o.pulse = 0;
      o.rumble = 0;
      o.dyn = false;
      o.kit = null;
      o.look = null;
      o.polys = null;
      o.draw = null;
      // In a shaped zone (see systems/obstacles/rockShapes.js) the pole is a hoodoo, fin, spire, icicle, lintel...: its collider is the union of convex quads that follow its outline (what the
      // renderer draws), chosen by position (no random numbers).
      const kit = rockKit(cx);
      if (kit) {
        const look = pickLook(kit, 'column', cap, cx);
        const gapEnd = cap > 0 ? yTop : yBottom;
        o.kit = kit;
        o.look = look;
        o.shape = 'poly';
        o.polys = columnPolys(kit, look, cx, gapEnd, cap, w, yBottom, yTop);
        o.extent = Math.max(o.extent, polysExtent(o.polys, cx));
        o.draw = poleInstances(kit, look, cap, gapEnd, w, poleReach(cap, gapEnd, w, yBottom, yTop).reach); // what the renderer places, worked out once
      }
    },
    block(x0, x1, yBottom, yTop, cap) {
      const o = obstacles.acquire();
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
      o.gap = Infinity;
      o.nm = false;
      o.dy = 0;
      o.solid = true;
      o.pulse = 0;
      o.rumble = 0;
      o.dyn = false;
      o.kit = null;
      o.look = null;
      o.polys = null;
      o.draw = null;
      // In a shaped zone a passage's upper slab is an arch span and its lower slab a terraced ledge (they only add room: see rockShapes.js).
      const kit = rockKit(o.x);
      if (kit) {
        o.kit = kit;
        o.look = cap < 0 ? 'arch' : 'ledge';
        o.shape = 'poly';
        o.polys = cap < 0 ? archPolys(kit, x0, x1, yBottom, yTop) : ledgePolys(kit, x0, x1, yBottom, yTop);
      }
    },
    rock(x, y, r) {
      const o = obstacles.acquire();
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
      o.gap = Infinity;
      o.nm = false;
      o.dy = 0;
      o.solid = true;
      o.pulse = 0;
      o.rumble = 0;
      o.dyn = false;
      o.kit = rockKit(x);
      o.look = o.kit ? 'boulder' : null;
      o.polys = null;
      o.draw = null;
    },
    item(kind, x, y) {
      const it = items.acquire();
      it.kind = kind;
      it.x = x;
      it.y = y;
      it.phase = hash01(x * 1.7) * Math.PI * 2; // a visual phase from the position: no random number is drawn, so tracks are unchanged
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
    phase: PHASE.READY,
    seed: 1,
    time: 0,
    distance: 0,
    prevDistance: 0,
    /** Distance at the moment of the crash; scoring freezes there. */
    scoredDistance: 0,
    speed: WORLD.baseSpeed,
    orbsCollected: 0,
    /** Orbs collected in a row without letting one slip past. */
    orbStreak: 0,
    bestStreak: 0,
    nearMisses: 0,
    /** What ended the run: 'lava' or an obstacle kind ('column' | 'block' | 'rock'). */
    crashCause: null,
    /** Milestones (worlds completed) announced so far this run: 0 to 4; the fifth is the finish line, which completes the journey. Only ever grows, so each fires once. */
    milestonesDone: 0,
    /** Seconds since the finish line (the ending's glide); 0 before it. */
    completeTime: 0,
    /** Power-ups: seconds of magnet left, whether the shield is held, and seconds of immunity left after it took a crash. */
    magnetLeft: 0,
    shield: false,
    /** Seconds the held shield has left (it runs out unused at 0); a shield set directly (tests) with 0 here never expires. */
    shieldLeft: 0,
    grace: 0,
    deathTime: 0,
    /** Interpolation factor between the last two fixed steps (set by the loop). */
    alpha: 1,
    bird: { y: WORLD.birdStartY, prevY: WORLD.birdStartY, vy: 0, pitch: 0, spin: 0, sinceFlap: 99, dead: false },
    input: { holding: false, dive: false, flapQueued: false },
    /** The biome hazards acting on the bird this step (gravity and flap scales, vertical acceleration...); neutral where there is none. Read by the renderer's telegraphs. */
    hazard: createHazardFx(),
    /** Camera/feedback impulses, decayed every step. */
    fx: { fovKick: 0, shake: 0, lift: 0 },
    obstacles,
    orbs,
    items,
    track,
    /** Events produced since the last drain. */
    events: [],

    get metres() {
      return toMetres(sim.phase === PHASE.RUNNING || sim.phase === PHASE.READY ? sim.distance : sim.scoredDistance);
    },
    /** True once the finish line was crossed alive. */
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
        // worlds completed by this run: a crash counts only what was behind it, the finish line all five
        worlds: sim.phase === PHASE.COMPLETE ? WORLD_COUNT : worldsCompleted(sim.scoredDistance),
      };
    },

    reset(seed = randomSeed()) {
      sim.seed = seed;
      rng.reseed(seed);
      obstacles.releaseAll();
      orbs.releaseAll();
      items.releaseAll();
      sim.magnetLeft = 0;
      sim.shield = false;
      sim.shieldLeft = 0;
      sim.grace = 0;
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
      b.y = b.prevY = WORLD.birdStartY;
      b.vy = b.pitch = b.spin = 0;
      b.sinceFlap = 99;
      b.dead = false;
      sim.input.holding = sim.input.dive = sim.input.flapQueued = false;
      sim.fx.fovKick = sim.fx.shake = sim.fx.lift = 0;
      hazardsAt(0, sim.hazard, track.corridors); // neutral: nothing from the last run lingers
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
      else if (sim.phase === PHASE.COMPLETE) stepComplete(dt);
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
    const hz = hazardsAt(sim.distance, sim.hazard, track.corridors);
    if (sim.input.flapQueued) {
      sim.input.flapQueued = false;
      applyFlap(b, hz);
      sim.fx.fovKick += 0.8;
      sim.fx.lift = 1;
      sim.events.push(FLAP_EVENT);
    }
    stepFlight(b, sim.input, dt, hz);
    if (sim.magnetLeft > 0) sim.magnetLeft = Math.max(0, sim.magnetLeft - dt);
    if (sim.shieldLeft > 0) {
      sim.shieldLeft = Math.max(0, sim.shieldLeft - dt);
      if (sim.shieldLeft === 0) sim.shield = false; // the timer ran out before any crash: the shield is gone unused
    }
    if (sim.grace > 0) sim.grace = Math.max(0, sim.grace - dt);

    sim.speed = speedAt(sim.distance);
    sim.distance += sim.speed * dt;
    fillTrack(track, builder, sim.distance, rng);

    const bx = sim.distance;
    const R = PHYSICS.birdRadius;
    const behind = bx - WORLD.despawnBehind;

    // Ground is lava: touching it ends the run.
    if (b.y - R <= WORLD.groundY) {
      if (sim.grace > 0 || shieldSave('lava', bx)) {
        b.y = WORLD.groundY + R + 0.05; // immune (or just saved by the shield): bounce off the floor
        if (b.vy < 6) b.vy = 6;
      } else {
        die('lava');
        return;
      }
    }

    for (const o of obstacles.active) {
      if (o.x + o.extent < behind) {
        obstacles.release(o);
        continue;
      }
      // the biome hazards move and phase some obstacles (see systems/hazards/biomeHazards.js); their state is a pure function of the bird's distance
      if (HAZARDS.enabled) {
        obstacleHazard(o, bx, HZ_OB);
        o.dy = HZ_OB.dy;
        o.solid = HZ_OB.solid;
        o.pulse = HZ_OB.pulse;
        o.rumble = HZ_OB.rumble;
        o.dyn = HZ_OB.dyn;
      }
      const ahead = o.x - bx;
      const band = o.extent + R + NEAR_MISS_GAP;
      if (ahead > band) continue; // broad phase
      if (ahead < -band) {
        // Passed cleanly: a close shave counts once.
        if (!o.nm && o.gap < NEAR_MISS_GAP) {
          o.nm = true;
          sim.nearMisses += 1;
          sim.events.push({ type: GAME_EVENTS.NEAR, x: o.x, y: b.y });
        }
        continue;
      }
      if (!o.solid) continue; // a phase barrier that is passable right now: no hit and no near miss
      // The bird is tested in the obstacle's own moved frame (dy), with 85% hitboxes on the moving ones.
      const cy = b.y - o.dy;
      const r = o.dyn ? R - DYNAMIC_INSET : R;
      if (circleHitsObstacle(bx, cy, r, o)) {
        if (sim.grace > 0 || shieldSave(o.kind, bx)) continue; // immune, or just saved by the shield
        die(o.kind);
        return;
      }
      const gap = circleGap(bx, cy, r, o);
      if (gap < o.gap) o.gap = gap;
    }

    // Flying hazards (systems/fliers): only near their encounter can one touch the bird. Smoke is harmless, a ring's rim and the tornado and disc are lethal (75% hitboxes); a shield absorbs one.
    if (FLIERS.enabled && !FLIERS.unseen) { // (unseen: their picture is missing, see FLIERS in fliers.js: never hurt the bird from where it cannot be seen)
      for (let i = 0; i < FLIER_SLOTS.length; i++) {
        const sl = FLIER_SLOTS[i];
        if (sl.e < bx - 4 || sl.e > bx + 4) continue;
        flierPlace(sl, bx, FP);
        if (!flierHits(sl, FP, b.y, R)) continue;
        if (sim.grace > 0 || shieldSave(sl.kind, bx, flierRescueY(sl, FP, b.y, WORLD.groundY + R, WORLD.ceilingY))) continue;
        die(sl.kind);
        return;
      }
    }

    // Magnet: orbs near the bird drift toward it; whether one is collected is still decided by the circle test below.
    if (sim.magnetLeft > 0) {
      for (const orb of orbs.active) {
        const mx = bx - orb.x;
        const my = b.y - orb.y;
        const d2 = mx * mx + my * my;
        if (d2 < MAGNET_RANGE * MAGNET_RANGE && d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const step = Math.min(d, MAGNET_PULL * dt);
          orb.x += (mx / d) * step;
          orb.y += (my / d) * step;
        }
      }
    }

    // Power-ups: picked up by a circle test like an orb's.
    const itemReach = R + ITEM_RADIUS;
    for (const it of items.active) {
      const dx = it.x - bx;
      if (dx < -WORLD.despawnBehind) {
        items.release(it);
        continue;
      }
      if (dx > itemReach) continue;
      const dy = it.y - b.y;
      if (dx * dx + dy * dy < itemReach * itemReach) {
        const kind = it.kind;
        items.release(it);
        if (kind === 'magnet') sim.magnetLeft = MAGNET_S;
        else {
          sim.shield = true;
          sim.shieldLeft = SHIELD_S; // a second shield refreshes the timer, never stacks
        }
        sim.fx.fovKick += 1.8;
        sim.events.push({ type: GAME_EVENTS.POWERUP, kind, x: it.x, y: it.y });
      }
    }

    const reach = R + ORB_RADIUS;
    for (const orb of orbs.active) {
      const dx = orb.x - bx;
      if (dx < -WORLD.despawnBehind) {
        orbs.release(orb);
        continue;
      }
      if (dx < -reach && !orb.missed) {
        // Slipped past uncollected: the streak is broken.
        orb.missed = true;
        sim.orbStreak = 0;
        continue;
      }
      if (dx > reach) continue;
      const dy = orb.y - b.y;
      if (dx * dx + dy * dy < reach * reach) {
        // Released immediately, so it can never be collected twice.
        orbs.release(orb);
        sim.orbsCollected += 1;
        sim.orbStreak += 1;
        if (sim.orbStreak > sim.bestStreak) sim.bestStreak = sim.orbStreak;
        sim.fx.fovKick += 1.4;
        sim.events.push({ type: GAME_EVENTS.ORB, x: orb.x, y: orb.y, streak: sim.orbStreak });
      }
    }

    // Milestones and the finish line are checked LAST: a step that ended in a crash returned above, so a collision always beats a milestone or the finish in the same step
    // (nothing is announced or granted for a border the bird did not survive). Each fires once: `milestonesDone` only grows and the phase leaves RUNNING at the finish.
    while (sim.milestonesDone < WORLD_COUNT - 1 && sim.distance >= MILESTONES[sim.milestonesDone].at) {
      const m = MILESTONES[sim.milestonesDone++];
      sim.events.push({ type: GAME_EVENTS.MILESTONE, index: m.index, at: m.at, world: m.world, name: m.name });
    }
    if (sim.distance >= JOURNEY_LENGTH) complete();
  }

  /**
   * The shield takes a crash that would have ended the run: it is spent, the bird is immune for GRACE_S seconds and (for an obstacle) is put back in the middle of the section's
   * guaranteed gap, which is clear by construction. Returns true when it saved the run.
   */
  function shieldSave(cause, bx, toY) {
    if (!sim.shield) return false;
    sim.shield = false;
    sim.shieldLeft = 0;
    sim.grace = GRACE_S;
    const b = sim.bird;
    if (toY !== undefined) {
      b.y = toY; // saved from a flying hazard: the middle of a ring's hole, or clear above or below the shape
      b.vy = 0;
    } else if (cause !== 'lava') {
      const c = track.corridors.find((k) => bx >= k.x0 - 1 && bx <= k.x1 + 1);
      if (c) {
        b.y = c.center;
        b.vy = 0;
      }
    }
    sim.fx.shake = 0.3;
    sim.events.push({ type: GAME_EVENTS.SHIELD_BREAK, x: bx, y: b.y, cause });
    return true;
  }

  /** The finish line, crossed alive: the run is over and won. The distance scored is exactly the journey's length. */
  function complete() {
    const b = sim.bird;
    sim.milestonesDone = WORLD_COUNT;
    sim.phase = PHASE.COMPLETE;
    sim.scoredDistance = JOURNEY_LENGTH;
    sim.completeTime = 0;
    sim.input.holding = sim.input.dive = sim.input.flapQueued = false;
    b.vy = 0;
    neutralHazards();
    sim.events.push({ type: GAME_EVENTS.COMPLETE, ...sim.results() });
  }

  /** The hazards stop acting at the finish line (and the obstacles stop moving). */
  function neutralHazards() {
    hazardsAt(0, sim.hazard, track.corridors);
  }

  /** The ending's glide: no input, no collisions, no new obstacles. The bird eases to a calm cruise and the world slows to a drift; what is behind it despawns as usual. */
  function stepComplete(dt) {
    const b = sim.bird;
    sim.completeTime += dt;
    sim.speed += (GLIDE_SPEED - sim.speed) * (1 - Math.exp(-1.1 * dt));
    sim.distance += sim.speed * dt;
    b.vy = Math.max(-3, Math.min(3, (GLIDE_Y - b.y) * 1.8));
    b.y += b.vy * dt;
    b.pitch += (0.12 - b.pitch) * (1 - Math.exp(-3 * dt));
    b.sinceFlap = (sim.completeTime * 1.1) % 0.9; // slow, calm wing beats
    const behind = sim.distance - WORLD.despawnBehind;
    for (const o of obstacles.active) if (o.x + o.extent < behind) obstacles.release(o);
    for (const orb of orbs.active) if (orb.x < behind) orbs.release(orb);
    for (const it of items.active) if (it.x < behind) items.release(it);
  }

  function die(cause) {
    const b = sim.bird;
    sim.crashCause = cause;
    sim.phase = PHASE.DYING;
    sim.scoredDistance = sim.distance;
    sim.deathTime = 0;
    b.dead = true;
    b.vy = Math.max(b.vy, 0) * 0.3 + 4; // knocked upward before falling
    sim.input.holding = sim.input.dive = sim.input.flapQueued = false;
    sim.fx.shake = 0.35;
    sim.events.push({ type: GAME_EVENTS.CRASH, x: sim.distance, y: b.y, cause });
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
