import { WORLD } from '../physics/constants.js';

/**
 * Canyon rock obstacle shapes (pure data and maths, no rendering): the outlines of the hoodoos, rock fins and arch lintels that stand in the first 1500 m, and the
 * convex polygons the simulation collides with. The renderer's geometry (components/scene/canyonRocks.js) is built from the very same outlines, so what the player sees
 * is what the bird hits.
 *
 * Fairness rules, all checked by scripts/rock-colliders-test.mjs:
 *  - a shape never reaches into its corridor: the gap end of a pole (its tip, cap or underside) stays at or beyond the gap edge, so the guaranteed clearance of every section is exactly
 *    what the patterns promise; arches and ledges only ADD room (their gap face rises or drops away from the corridor, and meets the original gap height at the section's ends);
 *  - nothing here draws a random number: which shape an obstacle gets comes from a hash of its position, so every generated track is identical to before.
 *
 * Outlines are measured in widths `w` of the pole, as distance `d` from the gap end along the pole. A control point is [d, left, right]: the pole spans from x - left to x + right there.
 */
const PERIODIC = (start, period, offsets) => ({ start, period, offsets });

/** Hoodoo: a flat-topped mushroom cap, then a waisted stem that wobbles in and out. */
const HOODOO = {
  head: [[0, 0.52, 0.52], [0.06, 0.6, 0.6], [0.32, 0.6, 0.6], [0.42, 0.48, 0.48], [0.58, 0.3, 0.3]],
  tail: PERIODIC(0.58, 1.8, [[0, 0.3], [0.45, 0.27], [0.9, 0.34], [1.35, 0.31], [1.8, 0.3]]),
};
/** Arch lintel (a hanging keystone): a flared, flat underside, then stepped blocky masonry. */
const LINTEL = {
  head: [[0, 0.5, 0.5], [0.12, 0.58, 0.58], [0.52, 0.58, 0.58], [0.64, 0.46, 0.46]],
  tail: PERIODIC(0.64, 1.4, [[0, 0.46], [0.58, 0.46], [0.7, 0.54], [1.28, 0.54], [1.4, 0.46]]),
};
/** Rock fin: a leaning blade, pointed at the gap end and widening to a solid foot. [d, half width, lean]; the lean flips with the fin's mirror. */
const FIN = [[0, 0.05, 0.28], [0.9, 0.2, 0.2], [1.8, 0.36, 0.12], [2.8, 0.48, 0.04], [3.6, 0.5, 0]];

/** Passage arch span and ledge shape constants (world units). */
export const ARCH_RISE = 0.5; // the span's underside rises this much in the middle (never below the section's gap height)
export const LEDGE_DROP = 0.6; // the ledge's top drops this much at its ends (never above the gap height)
export const LEDGE_BEVEL = 0.1; // over this fraction of its length, at each end

/**
 * Master switch. While the renderer still draws the original poles, the canyon keeps its original colliders (a visual that differs from its collider would be unfair);
 * the shapes are switched on when the matching geometry is drawn. The tests turn it on.
 */
export const ROCK_SHAPES = { enabled: false };

/** Deterministic 0..1 from a track position (no random numbers are drawn, so tracks are unchanged). */
export const hash01 = (x) => {
  const v = Math.sin(x * 12.9898 + 4.1414) * 43758.5453;
  return v - Math.floor(v);
};

/** The look of an obstacle at track position `x`, or null outside the canyon (the original shapes stay). `cap` > 0: it rises from the ground; < 0: it hangs. */
export function rockLook(kind, cap, x) {
  if (!ROCK_SHAPES.enabled || x >= WORLD.rockShapesEnd) return null;
  if (kind === 'rock') return 'boulder';
  if (kind === 'block') return cap > 0 ? 'ledge' : 'arch';
  const h = hash01(x);
  if (cap > 0) return h < 0.5 ? 'hoodoo' : 'fin';
  return h < 0.5 ? 'fin' : 'lintel';
}
/** Fins lean forward (towards +x). One direction keeps the renderer's mesh count down. */
export const finLean = () => 1;

/** Control points [d, left, right] of a pole look, from the gap end (d = 0) to `dMax` widths, the last one cut exactly at dMax. */
export function controlPoints(look, dMax, lean = 1) {
  let pts;
  if (look === 'fin') {
    pts = FIN.map(([d, hw, c]) => [d, hw - c * lean, hw + c * lean]);
    pts.push([Math.max(dMax, FIN[FIN.length - 1][0]) + 1, FIN[FIN.length - 1][1], FIN[FIN.length - 1][1]]);
  } else {
    const { head, tail } = look === 'hoodoo' ? HOODOO : LINTEL;
    pts = head.map((p) => p.slice());
    const { start, period, offsets } = tail;
    for (let k = 0; start + k * period <= dMax + period; k++) {
      for (let i = 1; i < offsets.length; i++) {
        const [o, hw] = offsets[i];
        pts.push([start + k * period + o, hw, hw]);
      }
    }
  }
  // cut at dMax
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (pts[i][0] >= dMax) {
      if (i === 0) out.push([0, pts[0][1], pts[0][2]]);
      else {
        const [d0, l0, r0] = pts[i - 1];
        const [d1, l1, r1] = pts[i];
        const t = d1 === d0 ? 0 : (dMax - d0) / (d1 - d0);
        out.push([dMax, l0 + (l1 - l0) * t, r0 + (r1 - r0) * t]);
      }
      return out;
    }
    out.push(pts[i]);
  }
  return out;
}

/** Orders a quad counter-clockwise (the collision tests need it). */
function ccw(p) {
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    a += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1];
  }
  if (a >= 0) return p;
  return [p[6], p[7], p[4], p[5], p[2], p[3], p[0], p[1]];
}

/**
 * The convex polygons of a pole (a rising or hanging column): one quad per stretch between control points, as flat [x0, y0, ... x3, y3] arrays in track coordinates, and a last quad
 * carrying the final width on to the far end. Only the part a bird can reach (down to just under the ground, up to just over the ceiling) is shaped; the rest is one plain quad.
 */
export function columnPolys(look, cx, gapEndY, cap, w, yBottom, yTop, lean = 1) {
  const dir = cap > 0 ? 1 : -1;
  const farY = cap > 0 ? yBottom : yTop;
  const { total, reach: dReach } = poleReach(cap, gapEndY, w, yBottom, yTop);
  const pts = controlPoints(look, dReach, lean);
  const polys = [];
  const yAt = (d) => gapEndY - dir * d * w;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [d0, l0, r0] = pts[i];
    const [d1, l1, r1] = pts[i + 1];
    polys.push(ccw([cx - l0 * w, yAt(d0), cx - l1 * w, yAt(d1), cx + r1 * w, yAt(d1), cx + r0 * w, yAt(d0)]));
  }
  if (total > dReach + 1e-9) {
    const [d, l, r] = pts[pts.length - 1];
    polys.push(ccw([cx - l * w, yAt(d), cx - l * w, farY, cx + r * w, farY, cx + r * w, yAt(d)]));
  }
  return polys;
}

/** Fractions along a passage slab where its outline is sampled: ten equal strips (the geometry stretches to the slab's length, so it uses the same ones). */
export const SLAB_STRIPS = 10;
export const slabSamples = () => Array.from({ length: SLAB_STRIPS + 1 }, (_, i) => i / SLAB_STRIPS);

/** Underside rise of an arch span at fraction u along it (0 at both springers). */
export const archRise = (u) => ARCH_RISE * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u))), 0.7);
/** How far a ledge's top drops below the gap height at fraction u along it (0 in the middle, LEDGE_DROP at each end). */
export const ledgeDrop = (u) => LEDGE_DROP * Math.max(0, 1 - Math.min(u, 1 - u) / LEDGE_BEVEL);

/** Arch span (the upper slab of a passage): the underside rises from the gap height at both ends; strips from there up to the slab's top. */
export function archPolys(x0, x1, yBottom, yTop) {
  const L = x1 - x0;
  const us = slabSamples();
  const polys = [];
  for (let i = 0; i + 1 < us.length; i++) {
    const xa = x0 + us[i] * L;
    const xb = x0 + us[i + 1] * L;
    polys.push([xa, yBottom + archRise(us[i]), xb, yBottom + archRise(us[i + 1]), xb, yTop, xa, yTop]);
  }
  return polys;
}

/** Ledge (the lower slab of a passage): the top drops away at both ends; strips from the slab's foot up to there. */
export function ledgePolys(x0, x1, yBottom, yTop) {
  const L = x1 - x0;
  const us = slabSamples();
  const polys = [];
  for (let i = 0; i + 1 < us.length; i++) {
    const xa = x0 + us[i] * L;
    const xb = x0 + us[i + 1] * L;
    polys.push([xa, yBottom, xb, yBottom, xb, yTop - ledgeDrop(us[i + 1]), xa, yTop - ledgeDrop(us[i])]);
  }
  return polys;
}

/** Furthest a set of polygons reaches sideways from `cx` (the broad-phase half length). */
export function polysExtent(polys, cx) {
  let m = 0;
  for (const p of polys) for (let i = 0; i < 8; i += 2) m = Math.max(m, Math.abs(p[i] - cx));
  return m;
}

/** The tables the geometry is built from (the same data the colliders use). */
export const POLE_TABLES = Object.freeze({ hoodoo: HOODOO, lintel: LINTEL, fin: FIN });
/** Where a fin's blade ends and its straight foot begins, in widths from the gap end. */
export const FIN_FOOT = FIN[FIN.length - 1][0];

/** How deep (in widths from the gap end) a pole's collider is shaped: only the part a bird can reach (see columnPolys). */
export function poleReach(cap, gapEndY, w, yBottom, yTop) {
  const farY = cap > 0 ? yBottom : yTop;
  const total = Math.abs(gapEndY - farY) / w;
  const reachY = cap > 0 ? WORLD.groundY - 0.5 : WORLD.ceilingY + 1.0;
  return { total, reach: Math.max(0.05, Math.min(total, Math.abs(gapEndY - reachY) / w)) };
}

/**
 * The pieces a pole is drawn from, for a pole shaped down to `dDraw` widths from its gap end: a head (cap, tip or underside), whole repeating segments of the stem (hoodoo,
 * lintel) or one stretched straight foot (fin), each given by its part name and where it starts (`d0`, in widths). The renderer places instances from this list and the tests
 * assemble the same list, so what is tested is what is drawn. Segments end at or beyond `dDraw`: the excess lies underground or above the ceiling, out of reach of the bird.
 */
export function polePlacements(look, dDraw) {
  if (look === 'fin') {
    const out = [{ part: 'head', d0: 0 }];
    if (dDraw > FIN_FOOT) out.push({ part: 'body', d0: FIN_FOOT, d1: dDraw });
    return out;
  }
  const { start, period } = look === 'hoodoo' ? HOODOO.tail : LINTEL.tail;
  const out = [{ part: 'head', d0: 0 }];
  for (let d = start; d < dDraw - 1e-9; d += period) out.push({ part: 'segment', d0: d });
  return out;
}
