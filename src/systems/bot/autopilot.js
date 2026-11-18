import { PHYSICS, WORLD } from '../physics/constants.js';
import { applyFlap, stepFlight } from '../physics/flight.js';
import { applyTime, speedAt } from '../obstacles/dynamics.js';
import { CELLS as GRID_CELLS, blockedIntervals, cellOf } from '../obstacles/planner.js';

/**
 * Autopilot: a bot that plays the game, for the watch-only "auto play" mode.
 *
 * How it plays. Every 0.1 s it chooses one of three inputs: do nothing, tap, or tap and hold.
 * It searches ahead 1.5 s over the bird's REAL flight state (height and vertical speed, advanced with
 * the game's own flap physics) against the REAL obstacles, including moving hazards at the moment the
 * bird will reach them. Plans that touch anything (inflated by a safety margin, so it never skims) are
 * discarded. Among the survivors it prefers the one that collects the most (orbs, gems, power-ups),
 * keeps the most clearance, and taps least, so what it shows is clean, learnable play.
 *
 * How it stays cheap. The search is built one layer at a time (`think`), a little each frame, so a
 * phone never sees a hitch. Each plan is computed for the state the bird WILL be in when the plan takes
 * over (the delay is predicted with the same physics), so the delay does not matter.
 *
* Beyond that window it asks the track's route planner (the cheap grid planner used to verify the track)
 * whether each plan ends somewhere that still has a way through the next 1.5 s, and strongly prefers plans
 * that do. Without that, a bot that climbs for an orb can end up too high to reach a gate that only just
 * came into view.
 *
 * It reads the simulation and presses inputs (`sim.flap()`, `sim.setHolding()`), exactly as a player
 * would, and changes nothing else. It is plain JavaScript with no React, so it is tested headlessly.
 */
const DECISION = 0.1; // s between inputs
const SUB = 12; // physics sub-steps per decision: 1/120 s each, exactly the simulation's own step
const DT = DECISION / SUB;
export const LAYERS = 22; // decisions searched ahead: 2.2 s

// Coarse grid used only to merge near-identical states (each stored state is a real trajectory).
const Y_CELL = 0.08;
const VY_CELL = 0.8;
const Y0 = WORLD.groundY;
const VY0 = PHYSICS.maxDiveSpeed;
const NY = Math.ceil((WORLD.ceilingY - Y0) / Y_CELL) + 1;
const NV = Math.ceil((PHYSICS.maxRiseSpeed - VY0) / VY_CELL) + 1;
const CELLS = NY * NV;

/** Extra radius the bot keeps clear of everything, so its play never looks lucky. */
const SAFETY = 0.15;
const R_PLAN = PHYSICS.birdRadius + SAFETY;
const GROUND_PLAN = PHYSICS.birdRadius + 0.08;
const REACH2 = (PHYSICS.birdRadius + 0.35) ** 2; // pickup radius, squared
const MAX_INTERVALS = 24;
const MAX_ORBS = 30;

const ACTIONS = [
  { flap: false, hold: false }, // do nothing
  { flap: true, hold: false }, // tap
  { flap: true, hold: true }, // tap and hold
];
/** A small cost per input, so it taps no more than it needs to. */
const COST = [0, 0.004, 0.005];

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createAutopilot(sim) {
  const nSub = LAYERS * SUB;

  // Search layers: one real (y, vy) state per merged cell, with parent links to read the plan back.
  const ys = [];
  const vs = [];
  const val = [];
  const mask = [];
  const parent = [];
  const act = [];
  for (let k = 0; k <= LAYERS; k++) {
    ys.push(new Float32Array(CELLS));
    vs.push(new Float32Array(CELLS));
    val.push(new Float32Array(CELLS));
    mask.push(new Int32Array(CELLS));
    parent.push(new Int32Array(CELLS));
    act.push(new Uint8Array(CELLS));
  }
  const counts = new Int32Array(LAYERS + 1);
  const cell = new Int32Array(CELLS);
  const slot = new Int32Array(CELLS);
  let stamp = 0;

  // Per-plan snapshot of the world over the search window.
  const xs = new Float32Array(nSub);
  const lo = new Float32Array(nSub * MAX_INTERVALS);
  const hi = new Float32Array(nSub * MAX_INTERVALS);
  const nInt = new Uint8Array(nSub);
  const orbX = new Float32Array(MAX_ORBS);
  const orbY = new Float32Array(MAX_ORBS);
  const orbV = new Float32Array(MAX_ORBS);
  let nOrbs = 0;
  const orbsAt = Array.from({ length: nSub }, () => []);
  const tmpLo = [];
  const tmpHi = [];

  /** Heights from which the track still has a way through, at the time the search window ends. */
  const safeRow = new Uint8Array(GRID_CELLS);
  let safeValid = false;

  const bird = { y: 0, vy: 0, lastVy: 0, pitch: 0, pitchVel: 0, roll: 0, rollVel: 0, accel: 0, diveAmt: 0, holding: false, sinceFlap: 99 };
  const inputs = { holding: false, dive: false };

  let plan = null; // the plan being flown: { t0, len, actions, applied }
  let pending = null; // the next plan, waiting for its start time
  let search = null; // the search in progress: { layer, rootT }
  let immediate = false; // planning right now from a standstill: no delay to allow for
  let emaFrame = 1 / 60;
  let layersPerThink = 1;
  const stats = { plans: 0, layers: 0, ms: 0, dead: 0 };
  let lastAction = { flap: false, hold: false };
  let leafInfo = null;

  const resetBird = (y, vy) => {
    bird.y = y;
    bird.vy = vy;
    bird.lastVy = vy;
    bird.pitch = bird.pitchVel = bird.roll = bird.rollVel = bird.accel = bird.diveAmt = 0;
    bird.sinceFlap = 99;
  };

  const newPlan = (t0, firstAction) => {
    const actions = new Uint8Array(LAYERS);
    actions[0] = firstAction;
    return { t0, len: LAYERS, actions, applied: -1 };
  };

  /** Decisions of delay to allow for the search, from how fast frames are really coming. */
  function latencyDecisions() {
    if (immediate) return 0;
    const frames = LAYERS / Math.max(1, layersPerThink);
    return clamp(Math.ceil((frames * emaFrame) / DECISION) + 1, 3, 12);
  }

  /** Where the bird will be, in the simulation's own steps, if `plan` is followed from now until `toT`. */
  function predict(toT) {
    resetBird(sim.bird.y, sim.bird.vy);
    inputs.holding = sim.input.holding;
    let t = sim.runTime;
    let x = sim.distance;
    const dt = 1 / 120;
    let applied = plan ? plan.applied : -1;
    while (t < toT - 1e-6) {
      if (plan) {
        const idx = Math.floor((t - plan.t0) / DECISION + 1e-6);
        if (idx > applied) {
          applied = idx;
          const a = ACTIONS[idx < plan.len ? plan.actions[idx] : 0];
          if (a.flap) applyFlap(bird);
          inputs.holding = a.hold;
        }
      }
      stepFlight(bird, inputs, dt);
      x += speedAt(x) * dt;
      t += dt;
    }
    return x;
  }

  function begin() {
    const t0 = sim.runTime;
    const lat = latencyDecisions();
    let rootT;
    if (plan) {
      const idx = Math.ceil((t0 + lat * DECISION - plan.t0) / DECISION - 1e-9);
      rootT = plan.t0 + Math.max(idx, plan.applied + 1) * DECISION;
    } else {
      rootT = t0 + lat * DECISION;
    }
    const rootX = predict(rootT);
    const rootY = bird.y;
    const rootVy = bird.vy;

    // x of the bird at every sub-step of the search window.
    let x = rootX;
    for (let j = 0; j < nSub; j++) {
      x += speedAt(x) * DT;
      xs[j] = x;
    }
    const xEnd = xs[nSub - 1];

    // Obstacles near the window, and a further 1.5 s beyond it (for the long-range check below). Moving ones
    // are copied, because the search sets them to other moments in time.
    const near = [];
    const xFar = xEnd + 1.5 * speedAt(xEnd) + 2;
    for (const o of sim.obstacles.active) {
      if (o.x + o.extent < rootX - 1 || o.x - o.extent > xFar) continue;
      if (o.dyn) {
        const c = Object.assign({}, o);
        if (o.nodes) c.nodes = Float32Array.from(o.nodes);
        near.push(c);
      } else near.push(o);
    }
    // Where each sub-step is blocked (as sorted intervals of height).
    const mark = (a, b) => {
      tmpLo.push(a);
      tmpHi.push(b);
    };
    for (let j = 0; j < nSub; j++) {
      tmpLo.length = tmpHi.length = 0;
      const t = rootT + (j + 1) * DT;
      for (const o of near) {
        if (Math.abs(o.x - xs[j]) > o.extent + R_PLAN + 0.3) continue;
        if (o.dyn) applyTime(o, t);
        blockedIntervals(o, xs[j], R_PLAN, mark);
      }
      // Sort by start, then merge overlaps.
      const order = tmpLo.map((_, i) => i).sort((a, b) => tmpLo[a] - tmpLo[b]);
      let n = 0;
      const base = j * MAX_INTERVALS;
      for (const i of order) {
        if (n > 0 && tmpLo[i] <= hi[base + n - 1]) hi[base + n - 1] = Math.max(hi[base + n - 1], tmpHi[i]);
        else if (n < MAX_INTERVALS) {
          lo[base + n] = tmpLo[i];
          hi[base + n] = tmpHi[i];
          n++;
        }
      }
      nInt[j] = n;
    }

    // Long-range check: from which heights is there still a way through, at the moment this window ends?
    const planner = sim.track && sim.track.planner;
    if (planner) {
      planner.safeNow(rootX, rootT, LAYERS * DECISION + 1.5, near, safeRow, 0.9, LAYERS * DECISION);
      safeValid = true;
    } else safeValid = false;

    // Pickups in the window, and which sub-steps each can be reached at.
    nOrbs = 0;
    const cand = [];
    for (const orb of sim.orbs.active) if (orb.x > rootX - 1 && orb.x < xEnd + 1) cand.push(orb);
    cand.sort((a, b) => a.x - b.x);
    for (const orb of cand) {
      if (nOrbs >= MAX_ORBS) break;
      orbX[nOrbs] = orb.x;
      orbY[nOrbs] = orb.y;
      // Gems are worth detours; a shield or magnet is worth less if one is already in effect.
      orbV[nOrbs] = orb.kind === 1 ? 4 : orb.kind === 2 ? (sim.shield ? 0.5 : 3) : orb.kind === 3 ? (sim.magnetTime > 0 ? 0.5 : 1.5) : 1;
      nOrbs++;
    }
    for (let j = 0; j < nSub; j++) {
      const list = orbsAt[j];
      list.length = 0;
      for (let i = 0; i < nOrbs; i++) if (Math.abs(orbX[i] - xs[j]) < 0.71) list.push(i);
    }

    // Layer 0: the single predicted root state.
    ys[0][0] = rootY;
    vs[0][0] = rootVy;
    val[0][0] = 0;
    mask[0][0] = 0;
    counts[0] = 1;
    search = { layer: 0, rootT, rootY, rootVy };
  }

  function expandLayer(k) {
    stamp++;
    let n = 0;
    const cnt = counts[k];
    const yk = ys[k];
    const vk = vs[k];
    const nextY = ys[k + 1];
    const nextV = vs[k + 1];
    const nextVal = val[k + 1];
    const nextMask = mask[k + 1];
    const nextParent = parent[k + 1];
    const nextAct = act[k + 1];
    for (let i = 0; i < cnt; i++) {
      for (let a = 0; a < 3; a++) {
        const A = ACTIONS[a];
        resetBird(yk[i], vk[i]);
        inputs.holding = A.hold;
        if (A.flap) applyFlap(bird);
        let v = val[k][i] - COST[a];
        let m = mask[k][i];
        let alive = true;
        for (let s = 0; s < SUB && alive; s++) {
          stepFlight(bird, inputs, DT);
          const j = k * SUB + s;
          if (bird.y - GROUND_PLAN <= Y0) {
            alive = false;
            break;
          }
          const base = j * MAX_INTERVALS;
          for (let q = 0, c = nInt[j]; q < c; q++) {
            if (bird.y > lo[base + q] && bird.y < hi[base + q]) {
              alive = false;
              break;
            }
          }
          if (!alive) break;
          const list = orbsAt[j];
          for (let q = 0; q < list.length; q++) {
            const oi = list[q];
            if (m & (1 << oi)) continue;
            const dx = orbX[oi] - xs[j];
            const dy = orbY[oi] - bird.y;
            if (dx * dx + dy * dy < REACH2) {
              m |= 1 << oi;
              v += orbV[oi];
            }
          }
        }
        if (!alive) continue;
        const iy = clamp(Math.round((bird.y - Y0) / Y_CELL), 0, NY - 1);
        const iv = clamp(Math.round((bird.vy - VY0) / VY_CELL), 0, NV - 1);
        const key = iy * NV + iv;
        if (cell[key] === stamp) {
          const at = slot[key];
          if (v > nextVal[at]) {
            nextY[at] = bird.y;
            nextV[at] = bird.vy;
            nextVal[at] = v;
            nextMask[at] = m;
            nextParent[at] = i;
            nextAct[at] = a;
          }
          continue;
        }
        cell[key] = stamp;
        slot[key] = n;
        nextY[n] = bird.y;
        nextV[n] = bird.vy;
        nextVal[n] = v;
        nextMask[n] = m;
        nextParent[n] = i;
        nextAct[n] = a;
        n++;
      }
    }
    counts[k + 1] = n;
  }

  /** Pick the best surviving leaf and read its inputs back as a plan. */
  function finish() {
    let d = LAYERS;
    while (d > 0 && counts[d] === 0) d--;
    const actions = new Uint8Array(LAYERS);
    const path = new Float32Array(LAYERS + 1).fill(NaN); // predicted height at each decision boundary (debugging)
    if (d === 0) {
      // Nothing survives (should not happen on a verified track): tap, and try again next time.
      stats.dead++;
      actions[0] = 1;
    } else {
      let best = 0;
      let bestScore = -Infinity;
      let safeLeaves = 0;
      const jLast = d * SUB - 1;
      for (let i = 0; i < counts[d]; i++) {
        // Prefer room to spare at the end of the window, and the middle of the flight band.
        let margin = Math.min(0.8, ys[d][i] - GROUND_PLAN - Y0 + 0.3, WORLD.ceilingY - ys[d][i] + 0.3);
        const base = jLast * MAX_INTERVALS;
        for (let q = 0; q < nInt[jLast]; q++) {
          const y = ys[d][i];
          margin = Math.min(margin, y <= lo[base + q] ? lo[base + q] - y : y - hi[base + q]);
        }
        let score = val[d][i] + 0.6 * (Math.max(0, margin) / 0.8) - 0.03 * Math.abs(ys[d][i] - 0.6);
        // Beyond the window: a plan that ends where no route continues is a trap, whatever it collected.
        if (safeValid && d === LAYERS && !safeRow[cellOf(ys[d][i])]) score -= 20;
        else if (safeValid && d === LAYERS) safeLeaves++;
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      }
      leafInfo = { leaves: counts[d], safeLeaves, safeValid, d };
      let idx = best;
      for (let k = d; k >= 1; k--) {
        actions[k - 1] = act[k][idx];
        path[k] = ys[k][idx];
        idx = parent[k][idx];
      }
      path[0] = ys[0][0];
    }
    pending = { t0: search.rootT, len: LAYERS, actions, applied: -1, rootY: search.rootY, rootVy: search.rootVy, reached: d, path, leafInfo };
    stats.plans++;
  }

  return {
    stats,
    get lastAction() {
      return lastAction;
    },
    get hasPlan() {
      return plan !== null;
    },
    /** The plan being flown (for tests and debugging). */
    get currentPlan() {
      return plan;
    },

    /** Forget everything (a new run, or the bird was moved). */
    reset() {
      plan = null;
      pending = null;
      search = null;
      lastAction = { flap: false, hold: false };
    },

    /**
     * Plan from the current state, all at once, and start flying it at the next step. Used from a
     * standstill (the run starting, a restart, a warp), where waiting for a plan would mean flying blind.
     */
    planNow() {
      plan = null;
      pending = null;
      immediate = true;
      begin();
      while (search.layer < LAYERS) {
        expandLayer(search.layer);
        search.layer++;
      }
      finish();
      search = null;
      immediate = false;
      plan = pending;
      pending = null;
    },

    /**
     * Presses the bird's inputs. Called by the simulation at the start of every fixed step, so
     * inputs land on exact decision boundaries whatever the frame rate.
     */
    control() {
      if (sim.phase === 'ready') {
        // Let the scene settle for a moment, then launch (the first input must be a flap, which starts the run).
        if (sim.time < 0.9) return;
        this.planNow();
        plan.actions[0] = Math.max(1, plan.actions[0]);
      } else if (sim.phase !== 'running') return;
      if (!plan) this.planNow();
      if (pending && sim.runTime >= pending.t0 - 1e-6) {
        plan = pending;
        pending = null;
        // How far the real bird is from where this plan was built to start it (for tests and tuning).
        stats.handoffs = (stats.handoffs || 0) + 1;
        stats.lateBy = Math.max(stats.lateBy || 0, sim.runTime - plan.t0);
        stats.maxRootErr = Math.max(stats.maxRootErr || 0, Math.abs(sim.bird.y - plan.rootY));
        stats.lastErr = sim.bird.y - plan.rootY;
      }
      const idx = Math.floor((sim.runTime - plan.t0) / DECISION + 1e-6);
      if (idx > plan.applied) {
        plan.applied = idx;
        const a = ACTIONS[idx < plan.len ? plan.actions[idx] : 0];
        sim.setHolding(a.hold);
        if (a.flap) sim.flap();
        lastAction = { flap: a.flap, hold: a.hold };
      }
    },

    /**
     * Do a little planning. Call once per frame; `budgetMs` is how long to spend (at least one layer is
     * always done), `frameDt` the real frame time, used to allow for the delay of a plan taking over.
     */
    think(budgetMs = 3, frameDt = 1 / 60, maxLayers = Infinity) {
      if (sim.phase !== 'running' || !plan) return;
      emaFrame = emaFrame * 0.9 + clamp(frameDt, 1 / 240, 0.1) * 0.1;
      if (!search) {
        if (pending) return; // the next plan has not taken over yet
        begin();
      }
      const t0 = now();
      let did = 0;
      while (search.layer < LAYERS) {
        expandLayer(search.layer);
        search.layer++;
        did++;
        if (did >= maxLayers || now() - t0 >= budgetMs) break;
      }
      stats.layers += did;
      stats.ms += now() - t0;
      layersPerThink = layersPerThink * 0.9 + did * 0.1;
      if (search.layer >= LAYERS) {
        finish();
        search = null;
      }
    },
  };
}

