/**
 * The wire grid of a torus as line segments (pairs of points, ready for <lineSegments>): `rings` circles round the tube
 * and `lines` lengthwise lines round the big circle. Cleaner than a triangle wireframe (no diagonals).
 * Returns a Float32Array of xyz pairs.
 */
export function torusGridLines({ major = 2.2, minor = 0.55, rings = 40, lines = 14, ringSegments = 24, lineSegments = 120 } = {}) {
  const out = [];
  const point = (u, v) => {
    const a = u * Math.PI * 2;
    const b = v * Math.PI * 2;
    const r = major + minor * Math.cos(b);
    return [r * Math.cos(a), minor * Math.sin(b), r * Math.sin(a)];
  };
  for (let i = 0; i < rings; i++) {
    const u = i / rings;
    for (let j = 0; j < ringSegments; j++) out.push(...point(u, j / ringSegments), ...point(u, (j + 1) / ringSegments));
  }
  for (let i = 0; i < lines; i++) {
    const v = i / lines;
    for (let j = 0; j < lineSegments; j++) out.push(...point(j / lineSegments, v), ...point((j + 1) / lineSegments, v));
  }
  return new Float32Array(out);
}

/** How many segments (not floats) `torusGridLines` makes for those options. */
export const torusGridSegmentCount = ({ rings = 40, lines = 14, ringSegments = 24, lineSegments = 120 } = {}) => rings * ringSegments + lines * lineSegments;
