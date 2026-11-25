import {
  BufferAttribute,
  Color,
  BoxGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  ConeGeometry,
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BIOMES } from '../../systems/world/biomes.js';

/**
 * Low-poly Sundarbans geometry, built from primitives (no model files, no extra dependencies), in the faceted
 * style of the Bulbuli project's mangroves. Each part is baked with a vertex colour and the parts are merged, so a
 * whole tree is ONE geometry and a whole layer of trees is ONE draw call (InstancedMesh).
 */
const S = BIOMES.sundarbans.scene;

export function paint(geometry, hex) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const c = new Color(hex);
  const colors = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = c.r;
    colors[i + 1] = c.g;
    colors[i + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
}

export function place(geometry, { position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] }) {
  const m = new Matrix4().compose(
    new Vector3(...position),
    new Quaternion().setFromEuler(new Euler(...rotation)),
    new Vector3(...scale),
  );
  geometry.applyMatrix4(m);
  return geometry;
}

/** A mangrove: slim trunk, four stilt roots, and a layered faceted canopy. About 1 unit tall, standing on y = 0. */
export function createMangroveGeometry(variant = 0) {
  const parts = [];
  parts.push(paint(place(new CylinderGeometry(0.035, 0.06, 0.62, 6), { position: [0, 0.4, 0] }), S.bark));
  // stilt (prop) roots arching out from the trunk to the mud
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + variant * 0.5;
    const out = 0.16;
    parts.push(
      paint(
        place(new CylinderGeometry(0.012, 0.02, 0.28, 4), {
          position: [Math.cos(a) * out * 0.55, 0.13, Math.sin(a) * out * 0.55],
          rotation: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5],
        }),
        S.root,
      ),
    );
  }
  // canopy: three flattened facets stacked and offset, so the silhouette is layered like the reference
  const lobes = [
    [0.0, 0.84, 0.0, 0.4, 0],
    [-0.26, 0.68, 0.06, 0.3, 1],
    [0.27, 0.64, -0.05, 0.28, 2],
    [0.02, 0.62, 0.12, 0.26, 3],
  ];
  lobes.forEach(([x, y, z, r, k], i) => {
    const flat = variant === 1 ? 0.68 : 0.78;
    parts.push(
      paint(
        place(new DodecahedronGeometry(r, 0), {
          position: [x, y, z],
          rotation: [0.3 * i, 0.9 * i + variant, 0],
          scale: [1.15, flat, 1.05],
        }),
        S.canopy[(i + variant) % S.canopy.length],
      ),
    );
  });
  return mergeGeometries(parts, false);
}

/** A pneumatophore: the small breathing-root spike that pokes out of the mud. About 1 unit tall. */
export function createPneumatophoreGeometry() {
  return paint(place(new ConeGeometry(0.06, 1, 5), { position: [0, 0.5, 0] }), S.mudDark);
}

/** A grass / fern tuft: three crossed blades. About 1 unit tall. */
export function createTuftGeometry() {
  const blades = [];
  for (let i = 0; i < 3; i++) {
    blades.push(
      paint(
        place(new ConeGeometry(0.07, 1, 3), {
          position: [Math.sin(i * 2.1) * 0.08, 0.5, Math.cos(i * 2.1) * 0.08],
          rotation: [Math.sin(i * 2.1) * 0.35, 0, Math.cos(i * 2.1) * 0.35],
        }),
        i === 1 ? '#5f9a4a' : '#3f7d3a',
      ),
    );
  }
  return mergeGeometries(blades, false);
}

/**
 * Red sandstone mesas for the Red Rock Canyon's parallax layers: each is a stack of three ledges (wide, medium, narrow) with a pale cap, about
 * 3 units wide and 3 tall, base on y = 0. One geometry (vertex colours) per layer, so one draw call.
 */
export function createCanyonMesas(colors) {
  const parts = [];
  const ledge = (w, h, d, y, color, x = 0) => parts.push(paint(place(new BoxGeometry(w, h, d), { position: [x, y + h / 2, 0], rotation: [0, 0.1 * (x + 1), 0] }), color));
  ledge(2.6, 1.3, 1.9, 0, colors[1]);
  ledge(2.0, 1.1, 1.5, 1.3, colors[0], -0.1);
  ledge(1.3, 1.0, 1.1, 2.4, colors[2], 0.15);
  parts.push(paint(place(new BoxGeometry(1.5, 0.12, 1.3), { position: [0.15, 3.46, 0] }), '#f0a070'));
  return mergeGeometries(parts, false);
}
