import { speedAt } from '../physics/speed.js';
import { circleHitsObstacle, circleGap } from '../physics/collision.js';
import { RUN } from './constants.js';
import { pressJump, stepRunner } from './physics.js';

/**
 * Auto play for the ground-runner (v2). The watch-only Auto play mode is a feature the owner asked to keep in every version
 * (see CLAUDE.md), so the runner has its own bot with the same interface as the flying game's: control() once per fixed step
 * (it presses the same inputs a player would, `sim.flap()` and `sim.setHolding()`), and reset() at the start of a run.
 *
 * How it plays. While she is on the land it looks at the next section (an obstacle, a pair or a pit). If simply running on is safe
 * it does nothing. Otherwise it tries jumping after each of a range of delays, as a hop or a full-power hold, by stepping a copy of
 * the REAL runner physics (physics.js) against the REAL obstacles, and keeps the plan that clears with the most room (and the most
 * orbs). It then waits out that delay and jumps. Plans that touch anything, inflated by a safety margin, are discarded.
 * It changes nothing else, so it is deterministic and runs the same headlessly (npm run test:runner) as in the browser.
 */
export const DECISION = 0.05; // s between decisions
const DT = 1 / 60; // the planner's own step
const MAX_DELAY = 1.4; // the longest wait before a planned jump: it covers the whole lookahead, so the right takeoff for a section just coming into view is always among the candidates
const DELAY_STEP = 0.05;
const HOLDS = [Infinity, 0.18]; // hold for the whole jump (full power) or only briefly (a hop)
const MARGINS = [0.16, 0.08, 0]; // safety margins to try, widest first; 0 only when nothing safer exists
// Planning starts when the next section is this many seconds away: close enough that a jump (the best takeoff is about 0.35 s before
// the obstacle) is within MAX_DELAY, so a plan that only jumps once is never asked to clear something a whole jump away.
const LOOKAHEAD = 1.3;
const SCOPE_AFTER = 2.6; // obstacles this far past the target section's end are left to the next plan

export function createRunnerAutopilot(sim) {
  const state = { stepsToDecision: 0, jumpAt: -1, holdFor: 0, holdLeft: 0 };
  const stats = { plans: 0, fallbacks: 0 };
  const scope = [];
  const pb = { y: 0, vy: 0, grounded: true, sinceGround: 0, buffer: 0, sinceFlap: 0 };
  const pin = { holding: false, dive: false };
  const scratchPits = [];

  /** Simulates a plan: jump after `delay` seconds (or never, delay < 0), holding for `hold` seconds. Returns { ok, clear, orbs }. */
  function simulate(delay, hold, margin, x0, endX, orbsNear) {
    pb.y = sim.bird.y;
    pb.vy = sim.bird.vy;
    pb.grounded = sim.bird.grounded;
    pb.sinceGround = sim.bird.sinceGround;
    pb.buffer = 0;
    pb.sinceFlap = 99;
    let x = x0;
    let t = 0;
    let jumped = false;
    let heldFor = 0;
    let clear = Infinity;
    let orbs = 0;
    for (let n = 0; n < 220; n++) {
      if (!jumped && delay >= 0 && t >= delay) {
        pressJump(pb);
        jumped = true;
      }
      pin.holding = jumped && heldFor < hold;
      if (pin.holding) heldFor += DT;
      x += speedAt(x) * DT;
      let supported = true;
      for (let i = 0; i < scratchPits.length; i++) {
        const p = scratchPits[i];
        if (x > p.x0 + RUN.pitLip - margin && x < p.x1 - RUN.pitLip + margin) supported = false;
      }
      stepRunner(pb, pin, DT, supported);
      t += DT;
      if (pb.y <= RUN.groundY - RUN.pitDeathDepth) return { ok: false, clear: -1, orbs };
      for (let i = 0; i < scope.length; i++) {
        const o = scope[i];
        if (o.kind === 'pit') continue;
        if (Math.abs(o.x - x) > o.extent + RUN.hitCircles[0].r + margin + 0.5) continue;
        for (const c of RUN.hitCircles) {
          if (circleHitsObstacle(x + c.dx, pb.y + c.dy, c.r + margin, o)) return { ok: false, clear: -1, orbs };
          const g = circleGap(x + c.dx, pb.y + c.dy, c.r, o);
          if (g < clear) clear = g;
        }
      }
      for (let i = 0; i < orbsNear.length; i++) {
        const orb = orbsNear[i];
        if (orb.taken) continue;
        for (const c of RUN.hitCircles) {
          const ox = orb.x - (x + c.dx);
          const oy = orb.y - (pb.y + c.dy);
          if (ox * ox + oy * oy < (c.r + RUN.orbRadius) ** 2) {
            orb.taken = true;
            orbs++;
            break;
          }
        }
      }
      // done once she has passed the whole target section and is back on the land
      if (x > endX && pb.grounded) break;
    }
    for (let i = 0; i < orbsNear.length; i++) orbsNear[i].taken = false;
    return { ok: true, clear, orbs };
  }

  /** Chooses what to do now: returns { delay, hold } of the best plan, or null for "keep running". */
  function plan() {
    const b = sim.bird;
    const x0 = sim.distance;
    const v = speedAt(x0);
    // the obstacles still ahead (or underfoot), in order
    scope.length = 0;
    const ahead = [];
    // (one already behind her by more than her body and the margin is no longer a danger: leaving it out stops her jumping at what she has just passed)
    for (const o of sim.obstacles.active) if (o.x + o.extent > x0 - 0.5) ahead.push(o);
    if (!ahead.length) return null;
    ahead.sort((a, c) => a.x - c.x);
    const first = ahead[0];
    if (first.x - first.extent - x0 > v * LOOKAHEAD) return null; // nothing close enough to matter yet
    let end = first.x + first.extent;
    scratchPits.length = 0;
    for (const o of ahead) {
      if (o.x - o.extent > end + SCOPE_AFTER) break;
      scope.push(o);
      if (o.kind === 'pit') scratchPits.push(o);
      end = Math.max(end, o.x + o.extent);
    }
    const orbsNear = [];
    for (const orb of sim.orbs.active) if (orb.x > x0 - 1 && orb.x < end + 2) orbsNear.push({ x: orb.x, y: orb.y, taken: false });
    stats.plans++;

    for (const margin of MARGINS) {
      const stay = simulate(-1, 0, margin, x0, end + 0.8, orbsNear);
      if (stay.ok) return null; // running on is safe with this margin: do nothing
      let best = null;
      for (let delay = 0; delay <= MAX_DELAY + 1e-9; delay += DELAY_STEP) {
        for (const hold of HOLDS) {
          const r = simulate(delay, hold, margin, x0, end + 0.8, orbsNear);
          if (!r.ok) continue;
          // room to spare (capped), then orbs; a hop is preferred only on a tie (full power is the more forgiving)
          const score = Math.min(r.clear, 0.35) + 0.12 * r.orbs + (hold === Infinity ? 0.001 : 0);
          if (!best || score > best.score) best = { delay, hold, score };
        }
      }
      if (best) return best;
    }
    stats.fallbacks++;
    return { delay: 0, hold: Infinity }; // nothing clears: jump now and hope
  }

  return {
    stats,
    reset() {
      state.stepsToDecision = 0;
      state.jumpAt = -1;
      state.holdLeft = 0;
    },
    /** Called once per fixed step, before the step. */
    control() {
      if (sim.phase === 'ready') {
        sim.flap(); // start the run
        return;
      }
      if (sim.phase !== 'running') return;
      // keep (or release) the hold of a jump already made
      if (state.holdLeft > 0) {
        state.holdLeft -= 1 / 120;
        sim.setHolding(true);
      } else if (sim.input.holding && !sim.bird.dead) {
        sim.setHolding(false);
      }
      if (!sim.bird.grounded && sim.bird.sinceGround > RUN.coyoteTime) return; // in the air: nothing to decide
      // a planned jump whose delay has run out
      if (state.jumpAt >= 0) {
        state.jumpAt -= 1 / 120;
        if (state.jumpAt <= 0) {
          state.jumpAt = -1;
          sim.flap();
          sim.setHolding(true);
          state.holdLeft = state.holdFor;
        }
        return;
      }
      state.stepsToDecision -= 1;
      if (state.stepsToDecision > 0) return;
      state.stepsToDecision = Math.round(DECISION * 120);
      const p = plan();
      if (!p) return;
      state.holdFor = Number.isFinite(p.hold) ? p.hold : 0.9;
      if (p.delay < DECISION * 0.5) {
        sim.flap();
        sim.setHolding(true);
        state.holdLeft = state.holdFor;
      } else {
        state.jumpAt = p.delay;
      }
    },
  };
}
