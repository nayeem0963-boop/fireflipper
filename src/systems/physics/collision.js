/**
 * 2D collision tests in the gameplay plane (x = track position, y = height).
 * Visuals have depth, but gameplay is strictly 2D, which keeps it readable
 * and fair.
 */

export function circleIntersectsBox(cx, cy, r, bx, by, hw, hh) {
  const dx = Math.max(Math.abs(cx - bx) - hw, 0);
  const dy = Math.max(Math.abs(cy - by) - hh, 0);
  return dx * dx + dy * dy < r * r;
}

export function circleIntersectsCircle(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const rr = ar + br;
  return dx * dx + dy * dy < rr * rr;
}

/**
 * A convex quad as a flat counter-clockwise array [x0, y0, x1, y1, x2, y2, x3, y3]: the distance from a point to its outline (squared) and whether the point is inside it.
 * Allocation-free: this runs for every nearby obstacle on every simulation step.
 */
function polyProbe(px, py, p, out) {
  let inside = true;
  let best = Infinity;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) & 3;
    const ax = p[2 * i];
    const ay = p[2 * i + 1];
    const ex = p[2 * j] - ax;
    const ey = p[2 * j + 1] - ay;
    const rx = px - ax;
    const ry = py - ay;
    if (ex * ry - ey * rx < 0) inside = false;
    const len2 = ex * ex + ey * ey;
    let t = len2 > 0 ? (rx * ex + ry * ey) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = rx - t * ex;
    const dy = ry - t * ey;
    const d2 = dx * dx + dy * dy;
    if (d2 < best) best = d2;
  }
  out.inside = inside;
  out.d2 = best;
}
const PROBE = { inside: false, d2: 0 };

export function circleIntersectsPoly(cx, cy, r, p) {
  polyProbe(cx, cy, p, PROBE);
  return PROBE.inside || PROBE.d2 < r * r;
}

/** Clearance between a circle and a convex quad: positive outside, negative when overlapping. */
export function circlePolyGap(cx, cy, r, p) {
  polyProbe(cx, cy, p, PROBE);
  return PROBE.inside ? -(Math.sqrt(PROBE.d2) + r) : Math.sqrt(PROBE.d2) - r;
}

/** Obstacle colliders are { shape: 'box', hw, hh }, { shape: 'circle', cr } or { shape: 'poly', polys } (a union of convex quads: the canyon's rock shapes). */
export function circleHitsObstacle(cx, cy, r, o) {
  if (o.shape === 'poly') {
    for (let i = 0; i < o.polys.length; i++) if (circleIntersectsPoly(cx, cy, r, o.polys[i])) return true;
    return false;
  }
  return o.shape === 'circle'
    ? circleIntersectsCircle(cx, cy, r, o.x, o.y, o.cr)
    : circleIntersectsBox(cx, cy, r, o.x, o.y, o.hw, o.hh);
}

/** Clearance between a circle and an obstacle's collider (negative when overlapping). */
export function circleGap(cx, cy, r, o) {
  if (o.shape === 'poly') {
    let best = Infinity;
    for (let i = 0; i < o.polys.length; i++) {
      const g = circlePolyGap(cx, cy, r, o.polys[i]);
      if (g < best) best = g;
    }
    return best;
  }
  if (o.shape === 'circle') return Math.hypot(cx - o.x, cy - o.y) - r - o.cr;
  const dx = Math.max(Math.abs(cx - o.x) - o.hw, 0);
  const dy = Math.max(Math.abs(cy - o.y) - o.hh, 0);
  return Math.hypot(dx, dy) - r;
}
