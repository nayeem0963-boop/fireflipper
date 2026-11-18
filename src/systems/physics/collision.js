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
 * Distance between the circle's edge and the collider's edge (> 0 when apart,
 * 0 at first touch). Used for near-miss detection; never for hit decisions,
 * which stay with the intersect tests above.
 */
export function clearanceToBox(cx, cy, r, bx, by, hw, hh) {
  const dx = Math.max(Math.abs(cx - bx) - hw, 0);
  const dy = Math.max(Math.abs(cy - by) - hh, 0);
  return Math.hypot(dx, dy) - r;
}

export function clearanceToCircle(ax, ay, ar, bx, by, br) {
  return Math.hypot(ax - bx, ay - by) - ar - br;
}

/** Colliders made of several equal circles: spinner arms and fire rings. */
function nodesHit(cx, cy, r, o) {
  const rr = (r + o.nr) * (r + o.nr);
  const nd = o.nodes;
  for (let i = 0, n = o.nodeCount * 2; i < n; i += 2) {
    const dx = nd[i] - cx;
    const dy = nd[i + 1] - cy;
    if (dx * dx + dy * dy < rr) return true;
  }
  return false;
}

function nodesClearance(cx, cy, r, o) {
  let best = Infinity;
  const nd = o.nodes;
  for (let i = 0, n = o.nodeCount * 2; i < n; i += 2) {
    best = Math.min(best, Math.hypot(nd[i] - cx, nd[i + 1] - cy));
  }
  return best - r - o.nr;
}

export function clearanceToObstacle(cx, cy, r, o) {
  if (o.shape === 'nodes') return nodesClearance(cx, cy, r, o);
  return o.shape === 'circle'
    ? clearanceToCircle(cx, cy, r, o.x, o.y, o.cr)
    : clearanceToBox(cx, cy, r, o.x, o.y, o.hw, o.hh);
}

/** Obstacle colliders are { shape: 'box', hw, hh }, { shape: 'circle', cr } or { shape: 'nodes', nodes, nodeCount, nr }. */
export function circleHitsObstacle(cx, cy, r, o) {
  if (o.shape === 'nodes') return nodesHit(cx, cy, r, o);
  return o.shape === 'circle'
    ? circleIntersectsCircle(cx, cy, r, o.x, o.y, o.cr)
    : circleIntersectsBox(cx, cy, r, o.x, o.y, o.hw, o.hh);
}
