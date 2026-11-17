import { PHYSICS, WORLD } from '../physics/constants.js';

/**
 * Motion of moving obstacles as pure functions of run time (seconds since the first flap), or, for falling
 * rocks, of the bird's distance. Keeping the motion a function of time or position, not of accumulated state,
 * makes it identical in every replay and ghost.
 */
export const DYN = Object.freeze({ NONE: 0, SWING: 1, GEYSER: 2, ROCKFALL: 3 });

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

/**
 * Falling rock. It hangs above the ceiling (shaking as the bird approaches), starts to fall when the bird is
 * `o.trigger` units away, and speeds up: its height is y0 - drop * p^2, where p runs from 0 (at the trigger) to
 * 1 when the bird reaches it. Tying the fall to the bird's distance, not to time, means the rock reaches the
 * same place at the same moment however fast the bird is going (slow-mo cannot change it), and the generator
 * can place the always-safe lane exactly. After passing the bird it keeps falling and shatters on the ground.
 */
export const ROCKFALL = Object.freeze({
  shatterLength: 1.4,
  /** After the bird has crossed, the rock slams down: it reaches the ground this much progress later. */
  slam: 0.22,
});

export function rockfallState(o, distance) {
  const p = (o.trigger - (o.x - distance)) / o.trigger;
  const floorY = WORLD.groundY + o.cr * 0.7;
  if (p < 0) {
    // Hanging: a growing tremble as the trigger point nears (a telegraph).
    const warn = Math.max(0, 1 + p * 3); // 0 until a third of the trigger distance before it, then 0..1
    return { y: o.y0 + Math.sin(distance * 9) * 0.06 * warn, live: false, landed: false, fade: 1 };
  }
  // Until the bird has cleared it the rock follows y0 - drop * p^2. Past that point it slams down faster
  // (same speed at the join, then accelerating), so it lands just behind the bird where the player can see it.
  const exitP = 1 + (o.cr + PHYSICS.birdRadius) / o.trigger;
  let y;
  let pImpact;
  if (p <= exitP) {
    y = o.y0 - o.drop * p * p;
    pImpact = exitP + ROCKFALL.slam;
  } else {
    const yExit = o.y0 - o.drop * exitP * exitP;
    const slope = -2 * o.drop * exitP;
    const accel = (yExit + slope * ROCKFALL.slam - floorY) / (ROCKFALL.slam * ROCKFALL.slam);
    const q = p - exitP;
    y = yExit + slope * q - accel * q * q;
    pImpact = exitP + ROCKFALL.slam;
  }
  if (p < pImpact && y > floorY) return { y, live: true, landed: false, fade: 1 };
  const since = ((p - pImpact) * o.trigger) / ROCKFALL.shatterLength;
  return { y: floorY, live: false, landed: true, fade: Math.max(0, 1 - since) };
}

/** Moves a dynamic obstacle record to its position at run time `rt` (and bird distance `distance`). */
export function animate(o, rt, distance = 0) {
  if (o.dyn === DYN.ROCKFALL) {
    const st = rockfallState(o, distance);
    o.y = st.y;
    o.live = st.live;
    o.landed = st.landed;
    o.fade = st.fade;
    return;
  }
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
