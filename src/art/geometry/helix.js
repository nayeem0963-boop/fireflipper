import { CatmullRomCurve3, Vector3 } from 'three';

/**
 * A point on a helix standing on the y axis: `u` runs 0 to 1 from bottom to top, making `turns` turns of the given
 * `radius` over `height`; `phase` turns it round (half a turn gives the partner strand of a double helix).
 */
export function helixPoint(u, { radius = 0.9, turns = 3, height = 5.5, phase = 0 } = {}, out = new Vector3()) {
  const a = u * turns * Math.PI * 2 + phase;
  return out.set(radius * Math.cos(a), (u - 0.5) * height, radius * Math.sin(a));
}

/** A smooth curve along a strand, for a tube to follow. */
export function helixCurve(options, samples = 200) {
  const points = Array.from({ length: samples + 1 }, (_, i) => helixPoint(i / samples, options));
  return new CatmullRomCurve3(points);
}
