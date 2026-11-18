import { PHYSICS, WORLD } from '../physics/constants.js';
import { applyTime, speedAt, timeAtDistance } from './dynamics.js';

/**
 * Route planner: proves a track section is survivable before it is used.
 *
 * Space is a grid of bird heights and the run is sampled every STEP_DT
 * seconds at the positions the bird will actually be at (speed is a function
 * of distance, so arrival times are exact). Between samples the bird can
 * climb at most MAX_RISE_RATE and sink at most MAX_DROP_RATE (conservative
 * sustained rates, rounded down to whole cells), and it may stay put. A
 * section is accepted only if, from EVERY height the bird could be at when
 * entering it, some route threads all the hazards, with the bird inflated by
 * a safety margin so the route has slack.
 *
 * "Unavoidable combination" therefore cannot ship: if the planner can't find
 * a way through, the generator rejects the section and tries something easier.
 */
export const MAX_RISE_RATE = 3.2; // units/s a player can sustain by tapping
export const MAX_DROP_RATE = 4.5; // units/s a player can descend and still recover in time

export const CELL = 0.05;
export const Y_MIN = WORLD.groundY + PHYSICS.birdRadius;
export const Y_MAX = WORLD.ceilingY;
export const CELLS = Math.floor((Y_MAX - Y_MIN) / CELL) + 1;
export const cellY = (i) => Y_MIN + i * CELL;
export const cellOf = (y) => Math.min(CELLS - 1, Math.max(0, Math.round((y - Y_MIN) / CELL)));

const STEP_DT = 0.05;
/** Extra radius the route must clear by (slack for imprecise flying). */
export const ROUTE_MARGIN = 0.1;
/**
 * How far ahead a player can first see a hazard on a narrow phone in portrait
 * at top speed (~6.7 u of view plus ~4.7 u of edge-warning glow). Moving
 * hazards must be avoidable from ANY height given only this much warning.
 */
export const SIGHT_DISTANCE = 11;
/** Moving hazards demand a much roomier route: timing is harder to judge than a fixed gap. */
export const MOVING_MARGIN = 0.28;
const MAX_SAMPLES = 480;
/** Sampling phases (fractions of a step) a moving-hazard section must pass at. */
const PHASES = [0];
/** Seconds of timing error a player is assumed to have (either way) on moving hazards. */
const TIMING_SLACK = 0.12;
const SUBSAMPLES = 7;
const UP = Math.floor((MAX_RISE_RATE * STEP_DT) / CELL + 1e-9);
const DOWN = Math.floor((MAX_DROP_RATE * STEP_DT) / CELL + 1e-9);

/**
 * Heights at which a bird circle of radius `r` at track position `px` would
 * touch obstacle `o`, as open intervals passed to `mark(lo, hi)`. This is the
 * same test as circleHitsObstacle, solved for y instead of tried cell by cell.
 */
export function blockedIntervals(o, px, r, mark) {
  if (o.shape === 'nodes') {
    const nd = o.nodes;
    for (let i = 0, n = o.nodeCount * 2; i < n; i += 2) {
      const rr = r + o.nr;
      const d2 = rr * rr - (nd[i] - px) * (nd[i] - px);
      if (d2 > 0) {
        const h = Math.sqrt(d2);
        mark(nd[i + 1] - h, nd[i + 1] + h);
      }
    }
  } else if (o.shape === 'circle') {
    const rr = r + o.cr;
    const d2 = rr * rr - (o.x - px) * (o.x - px);
    if (d2 > 0) {
      const h = Math.sqrt(d2);
      mark(o.y - h, o.y + h);
    }
  } else {
    const dx = Math.max(Math.abs(px - o.x) - o.hw, 0);
    const d2 = r * r - dx * dx;
    if (d2 > 0) {
      const h = o.hh + Math.sqrt(d2);
      mark(o.y - h, o.y + h);
    }
  }
}

export function createPlanner() {
  let markRow = 0;
  const markRange = (lo, hi) => {
    // Cells strictly inside (lo, hi) are blocked.
    const a = Math.max(0, Math.floor((lo - Y_MIN) / CELL + 1e-9) + 1);
    const b = Math.min(CELLS - 1, Math.ceil((hi - Y_MIN) / CELL - 1e-9) - 1);
    for (let j = a; j <= b; j++) grid[markRow + j] = 0;
  };
  function blockObstacle(row, px, rp, o) {
    markRow = row;
    blockedIntervals(o, px, rp, markRange);
  }

  const grid = new Uint8Array(MAX_SAMPLES * CELLS); // free, then overwritten by "safe"
  const prefix = new Int32Array(CELLS + 1);
  const fwd = new Uint8Array(CELLS);
  const fwd2 = new Uint8Array(CELLS);
  let samples = 0;

  /** Free cells at one sample: marks every height whose bird circle hits something. */
  function markFree(k, x, t, obstacles, margin) {
    const row = k * CELLS;
    grid.fill(1, row, row + CELLS);
    const rp = PHYSICS.birdRadius + margin;
    for (const o of obstacles) {
      if (Math.abs(o.x - x) > o.extent + rp + 0.6) continue;
      const moving = o.dyn !== '' && o.dyn !== undefined;
      // A moving hazard blocks a height if it is there at ANY moment within TIMING_SLACK of
      // when the bird passes (and across the whole sampling interval). A route that needs
      // a timing window narrower than a person can hit is not counted as a route.
      for (let pass = 0; pass < (moving ? SUBSAMPLES : 1); pass++) {
        const frac = pass / (SUBSAMPLES - 1);
        const dtp = -TIMING_SLACK + frac * (STEP_DT + 2 * TIMING_SLACK);
        if (moving) applyTime(o, t + dtp);
        const px = x + dtp * speedAt(x);
        blockObstacle(row, px, rp, o);
      }
    }
  }

  /**
   * Analyse the run from `xStart` to `xEnd` against `obstacles` (any iterable).
   * Fills the internal safe grid; returns how many samples it covers.
   */
  function analyse(xStart, tStart, xEnd, obstacles, margin, up = UP, down = DOWN) {
    let x = xStart;
    let t = tStart;
    let k = 0;
    while (x < xEnd && k < MAX_SAMPLES) {
      markFree(k, x, t, obstacles, margin);
      x += speedAt(x) * STEP_DT;
      t += STEP_DT;
      k++;
    }
    samples = k;
    // Backward pass: a cell is safe if it is free and some safe cell is reachable next step.
    for (let s = k - 2; s >= 0; s--) {
      const next = (s + 1) * CELLS;
      prefix[0] = 0;
      for (let j = 0; j < CELLS; j++) prefix[j + 1] = prefix[j] + grid[next + j];
      const row = s * CELLS;
      for (let i = 0; i < CELLS; i++) {
        if (!grid[row + i]) continue;
        const a = Math.max(0, i - down);
        const b = Math.min(CELLS - 1, i + up);
        if (prefix[b + 1] - prefix[a] === 0) grid[row + i] = 0;
      }
    }
    return k;
  }

  return {
    /** Which cells obstacle `o` blocks for a bird of radius r at px (testing aid). */
    blockedCells(o, px, r, out) {
      markRow = 0;
      grid.fill(1, 0, CELLS);
      blockObstacle(0, px, r, o);
      for (let i = 0; i < CELLS; i++) out[i] = grid[i] ? 0 : 1;
    },
    /** Safe cells at sample `k` (0 = now; valid after analyse). */
    safeAtSample(out, k = 0) {
      const row = Math.min(k, samples - 1) * CELLS;
      for (let i = 0; i < CELLS; i++) out[i] = samples ? grid[row + i] : 0;
    },

    /**
     * Validate a section. `start` is the set of cells the bird may occupy at
     * xStart. Returns true when every one of them can get through; on success
     * `outReach` holds the cells the bird can occupy at the end.
     *
     * With moving hazards the run is analysed at several sampling phases and
     * must pass at all of them: a fast hazard blocks a height for only ~0.1 s,
     * so a section that only works for one lucky alignment of the samples is
     * not really safe.
     */
    validate(start, xStart, xEnd, obstacles, outReach, margin = ROUTE_MARGIN) {
      let moving = false;
      for (const o of obstacles) {
        if (o.dyn) {
          moving = true;
          break;
        }
      }
      const phases = moving ? PHASES : [0];
      outReach.fill(0);
      for (const phase of phases) {
        const x0 = xStart + phase * speedAt(xStart) * STEP_DT;
        const k = analyse(x0, timeAtDistance(x0), xEnd, obstacles, margin);
        if (k < 2) return false;
        for (let i = 0; i < CELLS; i++) if (start[i] && !grid[i]) return false;
        // Forward pass through safe cells gives where the bird can be at the end.
        fwd.set(start);
        for (let s = 1; s < k; s++) {
          const row = s * CELLS;
          fwd2.fill(0);
          for (let i = 0; i < CELLS; i++) {
            if (!fwd[i]) continue;
            const a = Math.max(0, i - DOWN);
            const b = Math.min(CELLS - 1, i + UP);
            for (let j = a; j <= b; j++) if (grid[row + j]) fwd2[j] = 1;
          }
          fwd.set(fwd2);
        }
        for (let i = 0; i < CELLS; i++) if (fwd[i]) outReach[i] = 1; // union: stay conservative
      }
      return true;
    },

    /**
     * Safe heights right now, for bots and tests: analyse the next `horizon`
     * seconds. `effort` (0..1) scales the climb/drop rates assumed, so a bot
     * can plan with comfortable slack instead of at the limit.
     */
    safeNow(xNow, tNow, horizon, obstacles, out, effort = 1, lookahead = 0) {
      const xEnd = xNow + horizon * speedAt(xNow);
      analyse(
        xNow,
        tNow,
        xEnd,
        obstacles,
        ROUTE_MARGIN,
        Math.max(1, Math.floor(UP * effort)),
        Math.max(1, Math.floor(DOWN * effort)),
      );
      this.safeAtSample(out, Math.round(lookahead / STEP_DT));
    },
  };
}

/** Lowest and highest occupied cell heights of a reach set (null when empty). */
export function hullOf(reach) {
  let lo = -1;
  let hi = -1;
  for (let i = 0; i < CELLS; i++) {
    if (reach[i]) {
      if (lo < 0) lo = i;
      hi = i;
    }
  }
  return lo < 0 ? null : [cellY(lo), cellY(hi)];
}
