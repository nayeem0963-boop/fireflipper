import { WORLD } from '../physics/constants.js';

/**
 * Motion of moving obstacles as pure functions of run time (seconds since the first flap). Keeping the
 * motion a function of time, not of accumulated state, makes it identical in every replay and ghost.
 */
export const DYN = Object.freeze({ NONE: 0, SWING: 1, GEYSER: 2 });

/** Geyser cycle (seconds): telegraph, eruption, retract, then rest for whatever is left of the period. */
export const GEYSER = Object.freeze({ telegraph: 0.8, erupt: 1.1, retract: 0.3, rise: 0.18 });
/** Shortest period that still leaves a rest after the full cycle. */
export const GEYSER_MIN_PERIOD = GEYSER.telegraph + GEYSER.erupt + GEYSER.retract + 0.6;

const TWO_PI = Math.PI * 2;

/** Position of one edge of a swinging gate at run time `rt`. */
export function swingEdge(o, rt) {
  return o.edge0 + o.amp * Math.sin(TWO_PI * o.freq * rt + o.offset);
}

/** Geyser state at run time `rt`: height, whether it can hurt the bird, and how hot it looks (0..1). */
export function geyserState(o, rt) {
  const u = (rt + o.offset) % o.period;
  const { telegraph, erupt, retract, rise } = GEYSER;
  if (u < telegraph)
    return { h: 0.5 + 0.8 * (u / telegraph), live: false, glow: 0.4 + 0.4 * (u / telegraph) };
  if (u < telegraph + erupt) {
    const k = Math.min(1, (u - telegraph) / rise);
    return { h: o.maxH * (1 - (1 - k) * (1 - k)), live: true, glow: 1 };
  }
  if (u < telegraph + erupt + retract) {
    const h = o.maxH * (1 - (u - telegraph - erupt) / retract);
    return { h, live: h > 0.35, glow: 0.6 };
  }
  return { h: 0.35, live: false, glow: 0.12 };
}

/** Moves a dynamic obstacle record to its position at run time `rt`. */
export function animate(o, rt) {
  if (o.dyn === DYN.SWING) {
    const edge = swingEdge(o, rt);
    o.h = o.side < 0 ? edge - o.farY : o.farY - edge;
    o.y = (edge + o.farY) / 2;
    o.hh = o.h / 2 - 0.06;
    return;
  }
  const g = geyserState(o, rt);
  o.live = g.live;
  o.glow = g.glow;
  o.h = g.h;
  o.y = WORLD.groundY - 0.3 + g.h / 2;
  o.hh = g.h / 2 - 0.06;
}
