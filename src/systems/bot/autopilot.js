import { PHYSICS, WORLD } from '../physics/constants.js';
import { applyFlap, stepFlight } from '../physics/flight.js';
import { circleHitsObstacle } from '../physics/collision.js';
import { speedAt } from '../obstacles/spawner.js';
import { FLIERS, SLOTS as FLIER_SLOTS, flierHits, flierPlace } from '../fliers/fliers.js';
import { DYNAMIC_INSET, HAZARDS, createHazardFx, createObstacleFx, hazardsAt, obstacleHazard } from '../hazards/biomeHazards.js';

/**
 * Autopilot for the watch-only "Auto play" mode. A feature the owner asked to keep: do not remove it without
 * being told to (see CLAUDE.md).
 *
 * How it plays. Every DECISION seconds it picks one of three inputs (do nothing, tap, tap and hold) by searching
 * ahead over the bird's REAL flight state (height and vertical speed, advanced with the game's own flap physics
 * and speed curve) against the REAL obstacles. Plans that touch anything, inflated by a safety margin so it never
 * skims, are discarded. Among the survivors it prefers the plan that collects the most orbs, then the one that
 * taps least, so what it shows is clean, learnable play.
 *
 * It presses inputs exactly as a player would (`sim.flap()`, `sim.setHolding()`), at fixed-step boundaries, so it is
 * deterministic and runs the same headlessly (npm run test:autoplay) as in the browser. It changes nothing else.
 */
export const DECISION = 0.1; // s between inputs
const SUB = 12; // 1/120 s physics steps per decision: the simulation's own step
const DT = DECISION / SUB;
export const LAYERS = 12; // decisions searched ahead: 1.2 s

// Coarse grid used only to merge near-identical states (each stored state is a real trajectory).
const Y_CELL = 0.2;
const VY_CELL = 1.6;
const NV = Math.ceil((PHYSICS.maxRiseSpeed - PHYSICS.maxDiveSpeed) / VY_CELL) + 2;

const ORB_RADIUS = 0.35;
const REACH2 = (PHYSICS.birdRadius + ORB_RADIUS) ** 2;
const MAX_ORBS = 30;
/** Safety margins to try, widest first; the last (0) is only used when nothing safer exists. */
const MARGINS = [0.18, 0.08, 0];
/** A small cost per input, so it taps no more than it needs to. */
const COST = [0, 0.004, 0.005];
const ACTIONS = [
  { flap: false, hold: false },
  { flap: true, hold: false },
  { flap: true, hold: true },
];

export function createAutopilot(sim) {
  const state = { stepsToDecision: 0, started: false };
  const stats = { plans: 0, fallbacks: 0, maxMs: 0 };
  const near = [];
  const orbList = [];
  // Scratch bird reused for every simulated step.
  const b = { y: 0, vy: 0, pitch: 0, sinceFlap: 0 };
  const input = { holding: false, dive: false };
  // The biome hazards at a planned state's distance (the same function the simulation uses), so the bot plans with the real forces.
  const hz = createHazardFx();
  // the flying hazards the plan can meet (their place is a pure function of the distance, so the bot plans with the real thing)
  const nearFliers = [];
  const fp = { x: 0, dx: 0, y: 0 };
  const ob = createObstacleFx();

  /** Search from the bird's current state; returns the first action (0-2) of the best surviving plan. */
  function plan(margin) {
    const R = PHYSICS.birdRadius + margin;
    const GROUND = WORLD.groundY + R;
    const x0 = sim.distance;
    const horizon = speedAt(x0) * LAYERS * DECISION * 1.25 + 2;

    near.length = 0;
    for (const o of sim.obstacles.active) if (o.x + o.extent > x0 - 1 && o.x - o.extent < x0 + horizon) near.push(o);
    nearFliers.length = 0;
    if (FLIERS.enabled) for (const sl of FLIER_SLOTS) if (sl.e > x0 - 5 && sl.e < x0 + horizon + 5) nearFliers.push(sl);
    orbList.length = 0;
    for (const orb of sim.orbs.active) {
      if (orb.x > x0 - 1 && orb.x < x0 + horizon && orbList.length < MAX_ORBS) orbList.push(orb);
    }
    // power-ups are worth reaching too (they sit in line with the next gap, so they never cost safety): planned for like orbs
    for (const it of sim.items.active) {
      if (it.x > x0 - 1 && it.x < x0 + horizon && orbList.length < MAX_ORBS) orbList.push(it);
    }

    // A layer is a Map from merged cell to state { y, vy, hold, x, value, mask, first }.
    let layer = new Map();
    layer.set(0, { y: sim.bird.y, vy: sim.bird.vy, hold: sim.input.holding, x: x0, value: 0, mask: 0, first: -1 });
    let bestFallback = null;

    for (let k = 0; k < LAYERS; k++) {
      const next = new Map();
      for (const s of layer.values()) {
        // held for the 0.1 s of a decision: a window lasts at least 10 m, so this is faithful to the step-by-step simulation within a few centimetres
        hazardsAt(s.x, hz, sim.track.corridors);
        for (let a = 0; a < ACTIONS.length; a++) {
          const act = ACTIONS[a];
          b.y = s.y;
          b.vy = s.vy;
          b.pitch = 0;
          b.sinceFlap = 0;
          input.holding = act.hold;
          let x = s.x;
          let mask = s.mask;
          let gained = 0;
          let alive = true;
          for (let i = 0; i < SUB && alive; i++) {
            if (i === 0 && act.flap) applyFlap(b, hz);
            stepFlight(b, input, DT, hz);
            x += speedAt(x) * DT;
            if (b.y <= GROUND) {
              alive = false;
              break;
            }
            for (let n = 0; n < near.length; n++) {
              const o = near[n];
              if (Math.abs(o.x - x) > o.extent + R) continue;
              // moving and phasing obstacles at the planned distance: the same state the simulation will compute (a phased-out barrier is passable; a moved one is tested in its own frame)
              let cy = b.y;
              let r = R;
              if (HAZARDS.enabled) {
                obstacleHazard(o, x, ob);
                if (!ob.solid) continue;
                cy = b.y - ob.dy;
                if (ob.dyn) r = R - DYNAMIC_INSET;
              }
              if (circleHitsObstacle(x, cy, r, o)) {
                alive = false;
                break;
              }
            }
            for (let n = 0; n < nearFliers.length && alive; n++) {
              const sl = nearFliers[n];
              if (sl.e < x - 4 || sl.e > x + 4) continue;
              flierPlace(sl, x, fp);
              if (flierHits(sl, fp, b.y, R)) alive = false;
            }
            if (!alive) break;
            for (let n = 0; n < orbList.length; n++) {
              if (mask & (1 << n)) continue;
              const orb = orbList[n];
              const dx = orb.x - x;
              if (dx > 1 || dx < -1) continue;
              const dy = orb.y - b.y;
              if (dx * dx + dy * dy < REACH2) {
                mask |= 1 << n;
                gained += 1;
              }
            }
          }
          if (!alive) continue;
          const value = s.value + gained - COST[a];
          const key = Math.round(b.y / Y_CELL) * NV + Math.round((b.vy - PHYSICS.maxDiveSpeed) / VY_CELL);
          const prev = next.get(key);
          if (!prev || value > prev.value) {
            next.set(key, { y: b.y, vy: b.vy, hold: act.hold, x, value, mask, first: k === 0 ? a : s.first });
          }
        }
      }
      if (next.size === 0) break;
      layer = next;
      bestFallback = layer;
    }
    const final = bestFallback;
    if (!final) return -1;
    let best = null;
    for (const s of final.values()) if (!best || s.value > best.value) best = s;
    return best.first;
  }

  function decide() {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let a = -1;
    for (let m = 0; m < MARGINS.length && a < 0; m++) {
      a = plan(MARGINS[m]);
      if (m > 0 && a >= 0) stats.fallbacks++;
    }
    stats.plans++;
    stats.maxMs = Math.max(stats.maxMs, (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
    return a < 0 ? 1 : a; // nothing survives: flap and hope
  }

  return {
    stats,
    reset() {
      state.stepsToDecision = 0;
      state.started = false;
    },
    /** Call once per fixed simulation step, before sim.step(). */
    control() {
      if (sim.phase === 'ready') {
        // Hover for a moment so the viewer sees the start, then take off.
        if (sim.time > 0.9) {
          sim.flap();
          state.stepsToDecision = SUB;
        }
        return;
      }
      if (sim.phase !== 'running') return;
      if (state.stepsToDecision > 0) {
        state.stepsToDecision--;
        return;
      }
      const a = decide();
      const act = ACTIONS[a];
      sim.setHolding(act.hold);
      if (act.flap) sim.flap();
      state.stepsToDecision = SUB - 1;
    },
  };
}
