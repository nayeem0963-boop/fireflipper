import { PHYSICS } from '../physics/constants.js';

/**
 * Fixed-timestep driver. Turns variable frame times into a whole number of
 * identical simulation steps and leaves the remainder for render
 * interpolation (`sim.alpha`). The game loop and the headless tests share
 * this, so "same physics at any frame rate" is tested on the real code path.
 */
export function createStepper(sim) {
  let acc = 0;
  return {
    reset() {
      acc = 0;
      sim.alpha = 1;
    },
    /** Advance by one frame's worth of time. Returns the number of steps taken. */
    advance(frameDelta) {
      // Clamp long frames (tab switch, GC hitch) so the sim never takes huge leaps.
      acc += Math.min(Math.max(frameDelta, 0), PHYSICS.maxFrameDelta);
      const step = PHYSICS.fixedStep;
      let n = 0;
      // Epsilon: 1/60 s frames must give exactly two 1/120 s steps, not 1.999...
      while (acc >= step - 1e-9) {
        sim.step(step);
        acc -= step;
        n++;
      }
      if (acc < 0) acc = 0;
      sim.alpha = acc / step;
      return n;
    },
  };
}
