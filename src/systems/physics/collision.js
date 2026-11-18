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

/** Obstacle colliders are either { shape: 'box', hw, hh } or { shape: 'circle', cr }. */
export function circleHitsObstacle(cx, cy, r, o) {
  return o.shape === 'circle'
    ? circleIntersectsCircle(cx, cy, r, o.x, o.y, o.cr)
    : circleIntersectsBox(cx, cy, r, o.x, o.y, o.hw, o.hh);
}

/** Clearance between a circle and an obstacle's collider (negative when overlapping). */
export function circleGap(cx, cy, r, o) {
  if (o.shape === 'circle') return Math.hypot(cx - o.x, cy - o.y) - r - o.cr;
  const dx = Math.max(Math.abs(cx - o.x) - o.hw, 0);
  const dy = Math.max(Math.abs(cy - o.y) - o.hh, 0);
  return Math.hypot(dx, dy) - r;
}
