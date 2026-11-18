import { BoxGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, SphereGeometry, TorusGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { paint, place } from './mangroveGeometry.js';

/**
 * Arctic scenery built from primitives with vertex colours (no model files), after the paintings' research camp: orange dome tents,
 * a snowmobile, a radio mast, and a stone cairn with a tattered flag. A camp is ONE geometry, so a layer of camps is one draw call.
 * About 7 units wide, standing on y = 0 (the snow).
 */
const part = (geometry, color, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) => paint(place(geometry, { position: p, rotation: r, scale: s }), color);

/** A dome tent: a hemisphere with a darker door and a pale ground ring. */
function dome(x, z, radius, color, doorColor) {
  const parts = [
    part(new SphereGeometry(radius, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), color, { p: [x, 0, z], s: [1.15, 0.85, 1] }),
    part(new TorusGeometry(radius * 0.97, 0.05, 4, 10), '#f4f8fa', { p: [x, 0.03, z], r: [Math.PI / 2, 0, 0], s: [1.15, 1, 1] }),
    part(new BoxGeometry(radius * 0.5, radius * 0.55, 0.12), doorColor, { p: [x - radius * 0.4, radius * 0.28, z + radius * 0.85] }),
  ];
  return parts;
}

export function createArcticCamp(scene) {
  const [t1, t2] = scene.tent;
  const parts = [
    ...dome(-1.5, 0, 0.9, t1, '#3a2a22'),
    ...dome(0.2, 0.3, 1.05, t2, '#3a2a22'),
    ...dome(1.9, -0.2, 0.8, t1, '#3a2a22'),
    // snowmobile: a dark body on two skis
    part(new BoxGeometry(0.9, 0.32, 0.38), '#2c3236', { p: [3.3, 0.38, 0.2] }),
    part(new BoxGeometry(0.4, 0.3, 0.34), '#d8dde0', { p: [3.55, 0.64, 0.2] }),
    part(new BoxGeometry(1.1, 0.06, 0.1), '#1c2024', { p: [3.3, 0.1, 0.05] }),
    part(new BoxGeometry(1.1, 0.06, 0.1), '#1c2024', { p: [3.3, 0.1, 0.38] }),
    // radio mast with a guy line
    part(new CylinderGeometry(0.025, 0.04, 2.6, 4), '#9aa6ac', { p: [-0.1, 1.3, -1.0] }),
    part(new SphereGeometry(0.1, 5, 4), '#e8edf0', { p: [-0.1, 2.6, -1.0] }),
    part(new CylinderGeometry(0.008, 0.008, 1.7, 3), '#c8d0d4', { p: [0.5, 1.1, -0.85], r: [0.2, 0, -0.65] }),
  ];
  // cairn of stacked stones with a flag, a little apart from the tents
  [
    [-3.4, 0.22, 0.2, 0.42],
    [-3.1, 0.2, -0.15, 0.34],
    [-3.38, 0.62, 0.05, 0.32],
    [-3.34, 0.95, 0.06, 0.24],
  ].forEach(([x, y, z, r], i) => parts.push(part(new DodecahedronGeometry(r, 0), i % 2 ? '#9aa6ac' : '#b4bec3', { p: [x, y, z], r: [i, i * 1.7, 0], s: [1.1, 0.8, 1] })));
  parts.push(part(new CylinderGeometry(0.02, 0.025, 1.2, 4), '#4a3a30', { p: [-3.34, 1.7, 0.06] }));
  parts.push(part(new ConeGeometry(0.16, 0.55, 3), scene.flag, { p: [-3.05, 2.05, 0.06], r: [0, 0, -Math.PI / 2], s: [1, 1, 0.3] }));
  return mergeGeometries(parts, false);
}

/** A cluster of low, flat grey-slate outcrops poking through the snow (like the dark rocks in the paintings). */
export function createSnowOutcrops(colors) {
  const parts = [];
  [
    [0, 0.3, 0, 0.9, 0],
    [-1.1, 0.18, 0.15, 0.6, 1],
    [1.0, 0.16, -0.1, 0.55, 2],
    [0.35, 0.5, 0.1, 0.45, 0],
  ].forEach(([x, y, z, r, k], i) => {
    parts.push(part(new DodecahedronGeometry(r, 0), colors[k % colors.length], { p: [x, y, z], r: [0.2 * i, 0.9 * i, 0.15 * i], s: [1.4, 0.55 + (i % 2) * 0.15, 1.0] }));
  });
  return mergeGeometries(parts, false);
}
