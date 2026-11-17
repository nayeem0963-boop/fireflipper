import { BIRD_HITBOX } from './constants.js';

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

/** Does the bird (centre bx, by, nose pitched by `pitch` radians) touch obstacle `o`? */
export function birdHitsObstacle(bx, by, pitch, o) {
  const cos = Math.cos(pitch);
  const sin = Math.sin(pitch);
  for (const c of BIRD_HITBOX) {
    const cx = bx + c.x * cos - c.y * sin;
    const cy = by + c.x * sin + c.y * cos;
    if (circleHitsObstacle(cx, cy, c.r, o)) return true;
  }
  return false;
}

/** Lowest point of the bird's hitbox (for the lava check). */
export function birdBottom(by, pitch) {
  const cos = Math.cos(pitch);
  const sin = Math.sin(pitch);
  let bottom = Infinity;
  for (const c of BIRD_HITBOX) bottom = Math.min(bottom, by + c.x * sin + c.y * cos - c.r);
  return bottom;
}
