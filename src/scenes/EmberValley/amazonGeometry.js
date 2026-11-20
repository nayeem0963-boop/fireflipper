import { ConeGeometry, CylinderGeometry, DodecahedronGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BIOMES } from '../../systems/world/biomes.js';
import { paint, place } from './mangroveGeometry.js';

/**
 * Low-poly Amazon geometry, built from primitives (no model files, no extra dependencies), in the faceted style of
 * the Bulbuli project's rainforest: tall slender trunks with buttress roots and branching boughs under dense leafy
 * crowns. Parts carry vertex colours and are merged, so a tree is ONE geometry and a layer of trees ONE draw call.
 */
const S = BIOMES.amazon.scene;
const leaf = (i) => S.leaf[i % S.leaf.length];

/** A rainforest tree: about 1 unit tall (scale it taller than wide), standing on y = 0. */
export function createAmazonTreeGeometry(variant = 0) {
  const parts = [];
  parts.push(paint(place(new CylinderGeometry(0.022, 0.04, 1, 6), { position: [0, 0.5, 0] }), S.bark));
  // buttress roots flaring out at the base
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + variant * 0.7;
    parts.push(
      paint(
        place(new ConeGeometry(0.03, 0.14, 4), {
          position: [Math.cos(a) * 0.05, 0.05, Math.sin(a) * 0.05],
          rotation: [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9],
        }),
        S.bough,
      ),
    );
  }
  // boughs reaching out under the crown, each ending in a leafy tuft
  const boughs = [
    [0.7, 0.9, 0],
    [0.78, 2.4, 1],
    [0.86, 4.2, 2],
  ];
  boughs.forEach(([y, a, k]) => {
    const dx = Math.cos(a + variant);
    const dz = Math.sin(a + variant);
    parts.push(
      paint(
        place(new CylinderGeometry(0.008, 0.014, 0.26, 4), {
          position: [dx * 0.1, y + 0.05, dz * 0.1],
          rotation: [dz * 1.0, 0, -dx * 1.0],
        }),
        S.bough,
      ),
    );
    parts.push(
      paint(
        place(new DodecahedronGeometry(0.1, 0), {
          position: [dx * 0.22, y + 0.13, dz * 0.22],
          rotation: [k, k * 2, 0],
          scale: [1.2, 0.7, 1.2],
        }),
        leaf(k + variant),
      ),
    );
  });
  // dense crown: a few big flattened facets
  [
    [0, 1.0, 0, 0.24, 0],
    [-0.15, 0.93, 0.05, 0.18, 1],
    [0.16, 0.95, -0.04, 0.17, 2],
    [0.02, 1.07, 0.06, 0.16, 3],
  ].forEach(([x, y, z, r, k]) => {
    parts.push(
      paint(
        place(new DodecahedronGeometry(r, 0), { position: [x, y, z], rotation: [0.4 * k, 1.1 * k + variant, 0], scale: [1.25, 0.7, 1.15] }),
        leaf(k + variant),
      ),
    );
  });
  return mergeGeometries(parts, false);
}

/** An overhead leaf mass: a cluster of facets, about 1 unit across, centred on the origin. */
export function createLeafMassGeometry() {
  const parts = [];
  [
    [0, 0, 0, 0.5, 0],
    [-0.45, -0.1, 0.1, 0.38, 1],
    [0.46, -0.08, -0.08, 0.4, 2],
    [0.05, 0.12, 0.12, 0.36, 3],
    [-0.2, -0.22, -0.1, 0.3, 1],
    [0.25, -0.2, 0.12, 0.3, 0],
  ].forEach(([x, y, z, r, k]) =>
    parts.push(paint(place(new DodecahedronGeometry(r, 0), { position: [x, y, z], rotation: [k, k * 1.3, 0], scale: [1.2, 0.62, 1.1] }), leaf(k))),
  );
  return mergeGeometries(parts, false);
}

/** An understory fern / broadleaf plant: crossed leaf blades fanning out, about 1 unit tall. */
export function createFernGeometry() {
  const blades = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    blades.push(
      paint(
        place(new ConeGeometry(0.1, 0.9, 3), {
          position: [Math.cos(a) * 0.16, 0.38, Math.sin(a) * 0.16],
          rotation: [Math.sin(a) * 0.95, 0, -Math.cos(a) * 0.95],
        }),
        i % 2 ? '#3f8a3a' : '#2f6b2f',
      ),
    );
  }
  return mergeGeometries(blades, false);
}

/** A hanging vine: a thin dark-green strand, 1 unit long, hanging from y = 0 down to y = -1. */
export function createVineGeometry() {
  return paint(place(new CylinderGeometry(0.012, 0.012, 1, 3), { position: [0, -0.5, 0] }), S.vine);
}
