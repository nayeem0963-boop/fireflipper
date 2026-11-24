import { BufferGeometry, Float32BufferAttribute } from 'three';

/**
 * One low-poly lotus petal as a curved, pointed sheet: it starts at the origin, rises along +y, bends towards -z by
 * `curl` (so a closed flower cups inwards) and is slightly cupped across its width. A grid of `rows` x `cols` quads, so it
 * reads as faceted with flat shading.
 */
export function petalGeometry({ length = 1.6, width = 0.7, curl = 0.5, rows = 5, cols = 3 } = {}) {
  const positions = [];
  const index = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const half = Math.max(0.015, width * 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 0.75) * (1 - 0.18 * t));
    for (let c = 0; c <= cols; c++) {
      const s = (c / cols - 0.5) * 2;
      const cup = (1 - s * s) * 0.07 * width * Math.sin(Math.PI * t);
      positions.push(s * half, t * length, -curl * 0.5 * t * t * length + cup);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      const b = a + 1;
      const d = a + cols + 1;
      const e = d + 1;
      index.push(a, b, d, b, e, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
