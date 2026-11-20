import { BufferGeometry } from 'three';

/**
 * Splits an indexed wing geometry into the triangles left of the body (x < 0) and right of it (x >= 0), judged by
 * each triangle's centre. The two halves share the source's vertex data (no copy); only the triangle list differs.
 * Used to make a butterfly model's two wings, which are joined only at the body, beat separately.
 */
export function splitWing(geometry) {
  const index = geometry.index.array;
  const pos = geometry.getAttribute('position');
  const left = [];
  const right = [];
  for (let i = 0; i < index.length; i += 3) {
    const cx = (pos.getX(index[i]) + pos.getX(index[i + 1]) + pos.getX(index[i + 2])) / 3;
    (cx < 0 ? left : right).push(index[i], index[i + 1], index[i + 2]);
  }
  const make = (indices) => {
    const g = new BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      if (geometry.getAttribute(name)) g.setAttribute(name, geometry.getAttribute(name));
    }
    g.setIndex(indices);
    return g;
  };
  return { left: make(left), right: make(right) };
}
