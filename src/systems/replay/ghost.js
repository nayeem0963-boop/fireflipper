import { createGameSim, INPUT, PHASE } from '../game/createGameSim.js';
import { PHYSICS } from '../physics/constants.js';

/**
 * A "ghost" of an earlier run: a second simulation that replays recorded
 * inputs in lockstep with the live run, so the player can race their own
 * best attempt on the same track.
 *
 * Alignment: a run's physics depends on how long the bird hovered before the
 * first flap, so the ghost first fast-forwards through that same hover, then
 * waits. Call `step()` once for every fixed step the live run takes after it
 * has started, and the ghost flies exactly the path it originally did.
 */
export function createGhost(seed, log) {
  const sim = createGameSim();
  sim.reset(seed);
  let next = 0;
  const startTick = log.length ? log[0] : 0;
  // Hover through the original pre-flap time without any input.
  while (sim.tick < startTick) sim.step(PHYSICS.fixedStep);

  return {
    sim,
    /** True once the recorded run has crashed (the ghost then stays where it fell). */
    get finished() {
      return sim.phase === PHASE.DYING || sim.phase === PHASE.OVER;
    },
    step() {
      if (sim.phase === PHASE.OVER) return;
      while (next < log.length && log[next] <= sim.tick) {
        const code = log[next + 1];
        if (code === INPUT.FLAP) sim.flap();
        else if (code === INPUT.HOLD_ON) sim.setHolding(true);
        else if (code === INPUT.HOLD_OFF) sim.setHolding(false);
        else if (code === INPUT.DIVE_ON) sim.setDive(true);
        else sim.setDive(false);
        next += 2;
      }
      sim.step(PHYSICS.fixedStep);
      // Nothing consumes the ghost's events (the live run owns feedback), so don't let them pile up.
      sim.events.length = 0;
    },
  };
}
