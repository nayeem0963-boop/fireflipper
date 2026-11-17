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

/** Distance from point (px, py) to the line segment (ax, ay)-(bx, by). */
export function distanceToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / len2));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

/** Distance from a point to a spinning bar: pivot (o.x, o.y), half length o.hl, direction o.angle. */
function distanceToBar(cx, cy, o) {
  const dx = Math.cos(o.angle) * o.hl;
  const dy = Math.sin(o.angle) * o.hl;
  return distanceToSegment(cx, cy, o.x - dx, o.y - dy, o.x + dx, o.y + dy);
}

/**
 * Obstacle colliders are { shape: 'box', hw, hh }, { shape: 'circle', cr } or a spinning
 * { shape: 'bar', hl, hw, angle } (a capsule around a line segment through the pivot).
 */
export function circleHitsObstacle(cx, cy, r, o) {
  if (o.shape === 'circle') return circleIntersectsCircle(cx, cy, r, o.x, o.y, o.cr);
  if (o.shape === 'bar') return distanceToBar(cx, cy, o) < r + o.hw;
  return circleIntersectsBox(cx, cy, r, o.x, o.y, o.hw, o.hh);
}

/**
 * Gap between the bird's edge and the obstacle's collider surface
 * (negative once they overlap). Used for near-miss detection.
 */
export function clearanceToObstacle(cx, cy, r, o) {
  if (o.shape === 'circle') return Math.hypot(cx - o.x, cy - o.y) - o.cr - r;
  if (o.shape === 'bar') return distanceToBar(cx, cy, o) - o.hw - r;
  const dx = Math.max(Math.abs(cx - o.x) - o.hw, 0);
  const dy = Math.max(Math.abs(cy - o.y) - o.hh, 0);
  return Math.hypot(dx, dy) - r;
}
