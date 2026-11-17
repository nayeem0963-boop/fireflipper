import { createGameSim, INPUT, MAX_LOG_LENGTH, PHASE } from '../game/createGameSim.js';
import { PHYSICS } from '../physics/constants.js';

/**
 * Deterministic replay of a run from its seed and input log. The server uses
 * this to verify a submitted score instead of trusting the client: the
 * simulation is plain JavaScript driven by a seeded RNG and fixed timesteps,
 * so the same seed and inputs always give the same run.
 */

/** Hard cap on replay length: 20 minutes of fixed steps. */
export const MAX_TICKS = Math.round(20 * 60 * (1 / PHYSICS.fixedStep));

/** Checks the shape of an input log. Returns an error string, or null when it is well-formed. */
export function validateLog(log) {
  if (!Array.isArray(log)) return 'inputs must be an array';
  if (log.length === 0 || log.length % 2 !== 0) return 'inputs must be [tick, code] pairs';
  if (log.length > MAX_LOG_LENGTH) return 'inputs are too long';
  let previous = 0;
  for (let i = 0; i < log.length; i += 2) {
    const tick = log[i];
    const code = log[i + 1];
    if (!Number.isInteger(tick) || tick < previous || tick > MAX_TICKS) return 'invalid input tick';
    if (!Number.isInteger(code) || code < INPUT.FLAP || code > INPUT.DIVE_OFF) return 'invalid input code';
    previous = tick;
  }
  return null;
}

function apply(sim, code) {
  if (code === INPUT.FLAP) sim.flap();
  else if (code === INPUT.HOLD_ON) sim.setHolding(true);
  else if (code === INPUT.HOLD_OFF) sim.setHolding(false);
  else if (code === INPUT.DIVE_ON) sim.setDive(true);
  else sim.setDive(false);
}

/**
 * Re-runs a recorded run. Returns the results, or `finished: false` when
 * the run had not ended by the tick cap.
 */
export function replayRun(seed, log) {
  const sim = createGameSim();
  sim.reset(seed);
  let next = 0;
  while (sim.phase !== PHASE.OVER && sim.tick < MAX_TICKS) {
    while (next < log.length && log[next] <= sim.tick) {
      apply(sim, log[next + 1]);
      next += 2;
    }
    sim.step(PHYSICS.fixedStep);
  }
  const finished = sim.phase === PHASE.OVER;
  return { finished, ticks: sim.tick, ...sim.results() };
}
