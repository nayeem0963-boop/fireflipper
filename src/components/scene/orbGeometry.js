import { Color, ConeGeometry, Euler, Float32BufferAttribute, IcosahedronGeometry, Matrix4, OctahedronGeometry, TetrahedronGeometry, TorusGeometry, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ORB_FAMILIES } from '../../systems/world/orbFamilies.js';

/**
 * The five orb silhouettes, each ONE merged, vertex-coloured, unlit low-poly geometry (ring, core and sparks together: one draw call per family on screen). They are built once and shared.
 * All sit in the XY plane the camera looks at, inside a radius of about 0.42 (the old orb's glow reached 0.53), so what the player sees stays consistent with the unchanged hitbox.
 *
 *  - Solar:     a gold ring, a hot cream core and eight orange rays (a small sun).
 *  - Frost:     a hexagonal ring, an elongated icy octahedron core and six icicle spikes (a snow crystal).
 *  - Cosmic:    two crossed rings (a gyroscope) round a small core, with three magenta sparks.
 *  - Nature:    a thick ring, a round lime core and three leaf blades.
 *  - Celestial: a tilted thin halo ring round a four-point star, with four golden sparks.
 */
const M = new Matrix4();
const Q = new Quaternion();
const E = new Euler();
const V = new Vector3();

/** A part: a primitive, transformed and painted one colour, reduced to positions and colours so every part merges. */
function part(geometry, color, { position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  M.compose(V.set(position[0], position[1], position[2]), Q.setFromEuler(E.set(rotation[0], rotation[1], rotation[2])), new Vector3(scale[0], scale[1], scale[2]));
  g.applyMatrix4(M);
  const c = new Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new Float32BufferAttribute(arr, 3));
  return g;
}

/** `count` small parts spread round a circle of `radius`, each rotated to point outward. */
function spread(make, count, radius, offset = 0) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = offset + (i / count) * Math.PI * 2;
    out.push(make(Math.cos(a) * radius, Math.sin(a) * radius, a));
  }
  return out;
}

const BUILD = {
  solar(f) {
    return [
      part(new TorusGeometry(0.27, 0.045, 5, 20), f.ring),
      part(new IcosahedronGeometry(0.13, 0), f.core),
      ...spread((x, y, a) => part(new ConeGeometry(0.045, 0.14, 4), f.spark, { position: [x, y, 0], rotation: [0, 0, a - Math.PI / 2] }), 8, 0.36),
    ];
  },
  frost(f) {
    return [
      part(new TorusGeometry(0.27, 0.05, 4, 6), f.ring),
      part(new OctahedronGeometry(0.15, 0), f.core, { scale: [0.8, 1.35, 0.8] }),
      ...spread((x, y, a) => part(new ConeGeometry(0.04, 0.13, 3), f.spark, { position: [x, y, 0], rotation: [0, 0, a - Math.PI / 2] }), 6, 0.36),
    ];
  },
  cosmic(f) {
    return [
      part(new TorusGeometry(0.3, 0.042, 3, 14), f.ring),
      part(new TorusGeometry(0.3, 0.042, 3, 14), f.ring, { rotation: [1.15, 0, 0.5] }),
      part(new OctahedronGeometry(0.14, 0), f.core),
      ...spread((x, y) => part(new TetrahedronGeometry(0.06, 0), f.spark, { position: [x, y, 0] }), 3, 0.31, 0.6),
    ];
  },
  nature(f) {
    return [
      part(new TorusGeometry(0.25, 0.075, 5, 14), f.ring),
      part(new IcosahedronGeometry(0.12, 0), f.core),
      ...spread((x, y, a) => part(new OctahedronGeometry(0.11, 0), f.spark, { position: [x, y, 0], rotation: [0, 0, a], scale: [1.0, 0.45, 0.25] }), 3, 0.36, Math.PI / 2),
    ];
  },
  celestial(f) {
    return [
      part(new TorusGeometry(0.35, 0.036, 4, 20), f.ring, { rotation: [1.08, 0, 0] }),
      part(new OctahedronGeometry(0.2, 0), f.core, { scale: [0.3, 1, 0.3] }),
      part(new OctahedronGeometry(0.2, 0), f.core, { scale: [1, 0.3, 0.3] }),
      ...spread((x, y) => part(new TetrahedronGeometry(0.05, 0), f.spark, { position: [x, y, 0] }), 4, 0.26, Math.PI / 4),
    ];
  },
};

const cache = new Map();
/** The shared geometry of a family (built on first use). */
export function orbGeometry(id) {
  let g = cache.get(id);
  if (!g) {
    g = mergeGeometries(BUILD[id](ORB_FAMILIES[id]), false);
    g.computeBoundingSphere();
    cache.set(id, g);
  }
  return g;
}

/** Disposes every cached geometry (a hot reload, or leaving the game screen). */
export function disposeOrbGeometries() {
  for (const g of cache.values()) g.dispose();
  cache.clear();
}
