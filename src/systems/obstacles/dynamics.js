import { WORLD } from '../physics/constants.js';

/**
 * Moving hazards and the timeline they run on.
 *
 * Horizontal speed is a pure function of distance, so the moment the bird
 * reaches any track position is known in advance (`timeAtDistance`). Moving
 * hazards are therefore authored by what they are doing *at the moment the
 * bird arrives* (e.g. "this geyser is rising through half height"), and
 * every position is a pure function of run time. That makes them
 * deterministic, replayable and checkable by the route planner before they
 * ever appear.
 */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function speedAt(distance) {
  const k = clamp(distance / WORLD.speedRampDistance, 0, 1);
  return WORLD.baseSpeed + (WORLD.maxSpeed - WORLD.baseSpeed) * k;
}

/** Run time (s since the first flap) at which the bird reaches track position x. */
export function timeAtDistance(x) {
  if (x <= 0) return 0;
  const a = WORLD.baseSpeed;
  const v = WORLD.maxSpeed;
  const D = WORLD.speedRampDistance;
  const b = (v - a) / D;
  if (x <= D) return Math.log((a + b * x) / a) / b;
  return Math.log(v / a) / b + (x - D) / v;
}

export const BOULDER = Object.freeze({
  gravity: 15,
  startY: 7.2,
  /** Seconds the warning lane glows before the boulder starts to fall. */
  armLead: 0.9,
  /** Seconds a landed boulder lingers before sinking into the lava. */
  linger: 0.3,
});

/** Spinner arm: node centres along the bar (hub at 0), all the same radius. */
export const SPINNER = Object.freeze({
  offsets: Object.freeze([0, 0.5, -0.5, 0.95, -0.95, 1.45, -1.45]),
  nodeRadius: 0.26,
});

/**
 * Fire ring: a hoop the bird flies THROUGH. Side-on, its plane crosses the
 * flight line at only two places, a flame post above and one below the
 * opening, so the collider is two short rows of circles with a clear gap
 * between them (radius = half the opening, centre to post).
 */
export const RING = Object.freeze({ radius: 1.2, nodes: 6, nodeRadius: 0.22, spread: 0.3 });

export function fillRingNodes(o, x, y) {
  let i = 0;
  for (const side of [1, -1]) {
    for (const dx of [-RING.spread, 0, RING.spread]) {
      o.nodes[i * 2] = x + dx;
      o.nodes[i * 2 + 1] = y + side * RING.radius;
      i++;
    }
  }
  o.nodeCount = i;
}

/**
 * Put a dynamic obstacle into its state at run time `t`.
 * Parameters live on the record (p1..p5); see the builder in createGameSim.
 */
export function applyTime(o, t) {
  switch (o.dyn) {
    case 'geyser': {
      // Smooth up-and-down: s = 0 at rest height, 1 at full height.
      const s = 0.5 - 0.5 * Math.cos(o.p2 * (t - o.p3) + o.p1);
      const top = o.p4 + (o.p5 - o.p4) * s;
      const bottom = WORLD.groundY - 1.5;
      o.arm = s;
      o.y = (bottom + top) / 2;
      o.h = top - bottom;
      o.hh = o.h / 2 - 0.06;
      return;
    }
    case 'boulder': {
      const tau = t - o.p3;
      o.cr = o.r * 0.86;
      if (tau < 0) {
        o.y = o.p1;
        o.arm = clamp(1 + tau / BOULDER.armLead, 0, 1);
        o.landed = false;
        o.gone = false;
        return;
      }
      o.arm = 1;
      const floorY = WORLD.groundY + o.r * 0.55;
      const y = o.p1 - 0.5 * o.p2 * tau * tau;
      if (y <= floorY) {
        const tLand = Math.sqrt((2 * (o.p1 - floorY)) / o.p2);
        o.landed = true;
        o.gone = tau - tLand > BOULDER.linger;
        o.y = o.gone ? -30 : floorY;
        if (o.gone) o.cr = 0;
      } else {
        o.landed = false;
        o.gone = false;
        o.y = y;
      }
      return;
    }
    case 'spinner': {
      const th = o.p1 + o.p2 * (t - o.p3);
      o.rot = th;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const offs = SPINNER.offsets;
      for (let i = 0; i < offs.length; i++) {
        o.nodes[i * 2] = o.x + offs[i] * c;
        o.nodes[i * 2 + 1] = o.y + offs[i] * s;
      }
      return;
    }
    default:
  }
}
