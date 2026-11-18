import { ConeGeometry, CylinderGeometry, SphereGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { paint, place } from './mangroveGeometry.js';

/**
 * A floating crystal island, like the paintings' cities: a flat grassy top on an inverted rock cone, with a cluster of tall pastel crystal
 * spires and a few glowing flowers. ONE geometry (vertex colours), about 3 units across and 3 tall; the grass top is at y = 0 and the rock hangs below.
 */
const part = (geometry, color, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) => paint(place(geometry, { position: p, rotation: r, scale: s }), color);

export function createFloatingIsland(scene) {
  const [grassA, grassB, flower] = scene.grass;
  const parts = [
    part(new CylinderGeometry(1.5, 1.35, 0.22, 8), grassA, { p: [0, -0.11, 0] }), // the grassy top
    part(new ConeGeometry(1.35, 2.2, 7), scene.island, { p: [0, -1.3, 0], r: [Math.PI, 0, 0] }), // rock hanging underneath
    part(new ConeGeometry(0.55, 1.1, 6), '#3a4160', { p: [0.2, -2.1, 0.1], r: [Math.PI, 0.5, 0] }), // a second, smaller rock tier
  ];
  // crystal spires: one tall, several short, in the pastel crystal colours
  [
    [0, 0.0, 0, 0.26, 2.3, 0],
    [-0.7, 0.0, 0.2, 0.2, 1.4, 1],
    [0.65, 0.0, -0.2, 0.22, 1.7, 2],
    [-0.25, 0.0, -0.7, 0.16, 1.0, 1],
    [0.3, 0.0, 0.75, 0.16, 1.1, 0],
    [1.0, 0.0, 0.4, 0.13, 0.7, 2],
  ].forEach(([x, y, z, r, h, k], i) => {
    parts.push(part(new ConeGeometry(r, h, 4), scene.crystal[k % scene.crystal.length], { p: [x, y + h / 2, z], r: [0, i * 0.7, 0.04 * (i % 3 - 1)] }));
  });
  // a few glowing flowers on the grass
  [
    [-1.0, 0.1, -0.2, grassB],
    [0.9, 0.1, 0.6, flower],
    [-0.4, 0.1, 0.9, grassB],
    [0.5, 0.1, -0.9, flower],
  ].forEach(([x, y, z, c]) => parts.push(part(new SphereGeometry(0.14, 5, 4), c, { p: [x, y, z] })));
  return mergeGeometries(parts, false);
}
