import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';

/**
 * A parametric ribbon wound along a (p, q) torus knot, built as plain geometry: a strip of `segments` slices along
 * the knot and `across` columns over its width, twisted `twist` turns about the knot's own direction, with a gentle
 * lens-shaped bulge across the strip and an optional wobble of the centre line. Vertex colours run along the ribbon
 * through `colors` (hex strings), so a palette change needs only a rebuild, not a new material.
 *
 * Pure (three's maths only, no renderer), so it is checked by `npm run test:art`. Deterministic: the same options
 * always give the same positions.
 */
export const RIBBON_ACROSS = 8;

const TAU = Math.PI * 2;

/** Centre line of a (p, q) torus knot at u in [0, 1): a point standing on y-up. */
function knotPoint(u, p, q, radius, out) {
  const a = u * TAU * p;
  const qa = (q / p) * a;
  const k = (2 + Math.cos(qa)) * 0.5;
  return out.set(radius * k * Math.cos(a), radius * Math.sin(qa) * 0.5, radius * k * Math.sin(a));
}

/** Deterministic wobble of the centre line (a few incommensurate sines), at most `amount` in size. */
function wobble(u, amount, out) {
  return out.set(Math.sin(u * TAU * 7 + 1.3), Math.sin(u * TAU * 5 + 0.4), Math.sin(u * TAU * 3 + 2.1)).multiplyScalar(amount * 0.5);
}

export function ribbonKnotGeometry({ p = 3, q = 2, twist = 2, width = 0.25, noise = 0.1, segments = 400, radius = 1.6, colors = ['#ff5a14', '#ffb347', '#ffd36b'] } = {}) {
  const across = RIBBON_ACROSS;
  const rows = segments + 1;
  const positions = new Float32Array(rows * (across + 1) * 3);
  const colorData = new Float32Array(rows * (across + 1) * 3);
  const uvs = new Float32Array(rows * (across + 1) * 2);
  const ramp = colors.map((c) => new Color(c));

  const c0 = new Vector3();
  const c1 = new Vector3();
  const tangent = new Vector3();
  const side = new Vector3();
  const lift = new Vector3();
  const dir = new Vector3();
  const nrm = new Vector3();
  const point = new Vector3();
  const tint = new Color();
  const centre = (u, out) => knotPoint(u, p, q, radius, out).add(wobble(u, noise, c1));

  for (let i = 0; i < rows; i++) {
    const u = i / segments;
    centre(u, c0);
    centre(u + 1e-3, tangent).sub(c0).normalize();
    // Reference direction from the position (a torus knot never runs parallel to its own position vector for long).
    side.copy(c0).cross(tangent).normalize();
    lift.copy(tangent).cross(side).normalize();
    const theta = u * TAU * twist;
    dir.copy(side).multiplyScalar(Math.cos(theta)).addScaledVector(lift, Math.sin(theta));
    nrm.copy(tangent).cross(dir).normalize();

    // Colour: slide through the ramp along the ribbon (wrapping, so the seam matches).
    const f = (u * ramp.length) % ramp.length;
    const a = Math.floor(f);
    tint.copy(ramp[a % ramp.length]).lerp(ramp[(a + 1) % ramp.length], f - a);

    for (let j = 0; j <= across; j++) {
      const t = j / across;
      const w = (t - 0.5) * 2;
      point.copy(c0).addScaledVector(dir, w * width).addScaledVector(nrm, (1 - w * w) * width * 0.35);
      const k = (i * (across + 1) + j) * 3;
      positions[k] = point.x;
      positions[k + 1] = point.y;
      positions[k + 2] = point.z;
      // Slightly brighter at the middle of the strip than at its edges.
      const shade = 0.78 + 0.22 * (1 - w * w);
      colorData[k] = tint.r * shade;
      colorData[k + 1] = tint.g * shade;
      colorData[k + 2] = tint.b * shade;
      uvs[(i * (across + 1) + j) * 2] = u;
      uvs[(i * (across + 1) + j) * 2 + 1] = t;
    }
  }

  const index = [];
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * (across + 1) + j;
      const b = a + 1;
      const c = a + across + 1;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colorData, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
