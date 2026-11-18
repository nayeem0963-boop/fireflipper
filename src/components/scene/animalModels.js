import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { paint, place } from '../../scenes/EmberValley/mangroveGeometry.js';

/**
 * Low-poly animals and plants of the Sundarbans and the Amazon, built from primitives (no model files, no new
 * dependencies) with vertex colours, so each is ONE small geometry that is instanced per obstacle.
 *
 * Conventions: 1 unit is about 1 metre. Standing and lying animals face -x (towards the bird flying in from the left);
 * animals are modelled with their feet / belly on y = 0. Hanging animals (bats, sloths, the beehive, the boa) hang down
 * from y = 0. Flat creatures (the morpho butterfly) lie in the xy plane, facing the viewer.
 */

/** A primitive, painted and placed: part(geometry, colour, { p: position, r: rotation, s: scale }). */
const part = (geometry, color, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) => paint(place(geometry, { position: p, rotation: r, scale: s }), color);
const ball = (r, color, opt) => part(new SphereGeometry(r, 6, 4), color, opt);
const box = (w, h, d, color, opt) => part(new BoxGeometry(w, h, d), color, opt);
const cyl = (rt, rb, h, seg, color, opt) => part(new CylinderGeometry(rt, rb, h, seg), color, opt);
const cone = (r, h, seg, color, opt) => part(new ConeGeometry(r, h, seg), color, opt);
const merge = (list) => mergeGeometries(list, false);

/** A flat triangle fan / polygon (convex, points in order) in the xy plane at depth z, with one colour. */
function polygon(points, color, z = 0) {
  const c = new Color(color);
  const pos = [];
  for (let i = 1; i < points.length - 1; i++) {
    for (const [x, y] of [points[0], points[i], points[i + 1]]) pos.push(x, y, z);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  const colors = new Float32Array(pos.length);
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = c.r;
    colors[i + 1] = c.g;
    colors[i + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}
const mirrorX = (pts) => pts.map(([x, y]) => [-x, y]).reverse();

/* ============================================================== SUNDARBANS */

/** Bengal tiger crouched on the ground, facing -x. About 2.7 m long, 1 m tall. */
export function createTiger() {
  const orange = '#e8892a';
  const dark = '#1a1208';
  const cream = '#f2e3c0';
  const parts = [
    ball(0.5, orange, { p: [0.45, 0.55, 0], s: [1.75, 0.8, 0.85] }), // body
    ball(0.28, orange, { p: [-0.95, 0.72, 0], s: [1, 1, 0.95] }), // head
    ball(0.16, cream, { p: [-1.18, 0.64, 0], s: [1.1, 0.7, 0.9] }), // muzzle
    cone(0.07, 0.15, 4, orange, { p: [-0.9, 1.0, 0.14] }),
    cone(0.07, 0.15, 4, orange, { p: [-0.9, 1.0, -0.14] }),
    ball(0.04, '#101010', { p: [-1.12, 0.75, 0.13] }),
    ball(0.04, '#101010', { p: [-1.12, 0.75, -0.13] }),
    cyl(0.1, 0.12, 0.5, 5, orange, { p: [-0.55, 0.25, 0.22] }), // front legs
    cyl(0.1, 0.12, 0.5, 5, orange, { p: [-0.55, 0.25, -0.22] }),
    cyl(0.11, 0.14, 0.5, 5, orange, { p: [1.05, 0.25, 0.22] }), // hind legs
    cyl(0.11, 0.14, 0.5, 5, orange, { p: [1.05, 0.25, -0.22] }),
    cyl(0.05, 0.07, 1.0, 5, orange, { p: [1.65, 0.62, 0], r: [0, 0, 1.0] }), // tail curling up
    cone(0.07, 0.2, 5, dark, { p: [2.0, 0.95, 0], r: [0, 0, -0.9] }),
  ];
  for (let i = 0; i < 6; i++) parts.push(box(0.07, 0.5, 0.78, dark, { p: [-0.2 + i * 0.33, 0.66, 0], r: [0, 0, 0.18 * (i % 2 ? 1 : -1)] })); // stripes
  return merge(parts);
}

/** Saltwater crocodile lying along the ground, facing -x. About 4.3 m long, 0.5 m tall. */
export function createCrocodile() {
  const olive = '#6f7f45';
  const dark = '#3f4a26';
  const belly = '#c9c387';
  const parts = [
    ball(0.42, olive, { p: [0.4, 0.3, 0], s: [2.4, 0.55, 1.0] }), // body
    box(1.25, 0.22, 0.42, olive, { p: [-1.5, 0.2, 0], r: [0, 0, 0.04] }), // snout
    box(1.2, 0.08, 0.36, belly, { p: [-1.5, 0.1, 0] }),
    ball(0.26, olive, { p: [-0.85, 0.3, 0], s: [1.1, 0.8, 1.2] }), // head
    ball(0.07, '#e8d44a', { p: [-0.9, 0.5, 0.16] }), // eyes on top
    ball(0.07, '#e8d44a', { p: [-0.9, 0.5, -0.16] }),
    cone(0.5, 2.0, 5, olive, { p: [2.35, 0.2, 0], r: [0, 0, Math.PI / 2], s: [0.55, 1, 0.45] }), // tail
    cyl(0.07, 0.09, 0.3, 4, olive, { p: [-0.25, 0.1, 0.5], r: [0.9, 0, 0] }), // legs
    cyl(0.07, 0.09, 0.3, 4, olive, { p: [-0.25, 0.1, -0.5], r: [-0.9, 0, 0] }),
    cyl(0.07, 0.09, 0.3, 4, olive, { p: [1.2, 0.1, 0.5], r: [0.9, 0, 0] }),
    cyl(0.07, 0.09, 0.3, 4, olive, { p: [1.2, 0.1, -0.5], r: [-0.9, 0, 0] }),
  ];
  for (let i = 0; i < 9; i++) parts.push(cone(0.07, 0.16, 4, dark, { p: [-0.5 + i * 0.32, 0.58 - i * 0.02, 0] })); // ridge of scutes
  for (let i = 0; i < 5; i++) parts.push(cone(0.03, 0.06, 3, '#f4f0e0', { p: [-1.95 + i * 0.22, 0.1, 0.21], r: [Math.PI, 0, 0] })); // teeth
  return merge(parts);
}

/** A fruit bat hanging upside down (head down), about 0.9 m tall with folded wings. Hangs from y = 0. */
export function createFruitBat() {
  const fur = '#8a5a3a';
  const mantle = '#d9a441';
  const wing = '#5a3a2a';
  return merge([
    cyl(0.01, 0.01, 0.12, 3, '#222222', { p: [0, -0.04, 0] }),
    ball(0.2, fur, { p: [0, -0.36, 0], s: [1, 1.5, 0.9] }), // body
    ball(0.17, mantle, { p: [0, -0.2, 0.02], s: [1.1, 0.6, 1] }), // golden mantle
    ball(0.14, fur, { p: [0, -0.66, 0], s: [1, 1, 1] }), // head
    cone(0.05, 0.12, 4, fur, { p: [-0.1, -0.52, 0.02], r: [Math.PI, 0, 0.2] }),
    cone(0.05, 0.12, 4, fur, { p: [0.1, -0.52, 0.02], r: [Math.PI, 0, -0.2] }),
    ball(0.035, '#fff2b0', { p: [-0.05, -0.68, 0.12] }),
    ball(0.035, '#fff2b0', { p: [0.05, -0.68, 0.12] }),
    cone(0.2, 0.7, 4, wing, { p: [-0.22, -0.4, 0.04], r: [Math.PI, 0, 0.12], s: [0.7, 1, 0.5] }), // folded wings
    cone(0.2, 0.7, 4, wing, { p: [0.22, -0.4, 0.04], r: [Math.PI, 0, -0.12], s: [0.7, 1, 0.5] }),
  ]);
}

/** A wild honey hive hanging from a branch: a golden-brown teardrop comb with a few bees. Hangs from y = 0, ~1.1 m tall. */
export function createHoneyHive() {
  const comb = '#d9a441';
  const dark = '#8a5a1a';
  const parts = [
    cyl(0.05, 0.05, 0.2, 5, '#4a3322', { p: [0, -0.05, 0] }), // stalk
    ball(0.42, comb, { p: [0, -0.35, 0], s: [1, 1.0, 0.9] }),
    ball(0.3, comb, { p: [0, -0.72, 0], s: [1, 1.15, 0.9] }),
    cone(0.2, 0.3, 6, comb, { p: [0, -1.02, 0], r: [Math.PI, 0, 0] }),
  ];
  for (let i = 0; i < 4; i++) parts.push(box(0.9 - i * 0.12, 0.05, 0.8 - i * 0.1, dark, { p: [0, -0.18 - i * 0.2, 0] })); // comb bands
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4;
    parts.push(ball(0.045, i % 2 ? '#2a2010' : '#f2c230', { p: [Math.cos(a) * 0.55, -0.3 - (i % 4) * 0.18, Math.sin(a) * 0.4 + 0.2], s: [1.4, 1, 1] }));
  }
  return merge(parts);
}

/** A swarm of angry bees: an amber ball of comb-coloured fuzz with black and yellow bees on its surface. Radius about 1. */
/** The solid amber core of the swarm (the part that stands for the collider). */
export function createBeeCore() {
  return part(new DodecahedronGeometry(0.92, 1), '#e0a030');
}
export function createBeeSwarm() {
  const parts = [createBeeCore()];
  for (let i = 0; i < 42; i++) {
    const a = i * 2.399; // golden angle: a Fibonacci sphere spreads the bees evenly over the ball
    const y = 1 - (2 * (i + 0.5)) / 42;
    const r = Math.sqrt(1 - y * y);
    const d = [Math.cos(a) * r, y, Math.sin(a) * r];
    parts.push(
      ball(0.075, i % 3 === 0 ? '#2a2010' : i % 3 === 1 ? '#f2c230' : '#5a3a10', {
        p: [d[0] * 1.02, d[1] * 1.02, d[2] * 1.02],
        s: [1.5, 1, 1],
        r: [0, a, 0],
      }),
    );
    // a pale wing on every other bee
    if (i % 2) parts.push(box(0.16, 0.02, 0.07, '#fff6d0', { p: [d[0] * 1.12, d[1] * 1.12, d[2] * 1.12], r: [0, a, 0.5] }));
  }
  return merge(parts);
}

/** Roots flaring at the water line, for a Sundari mangrove: a ring of stilt roots about 1.2 m across, 0.9 m tall. */
export function createStiltRoots() {
  const parts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push(cyl(0.035, 0.07, 1.0, 4, '#4a3222', { p: [Math.cos(a) * 0.42, 0.42, Math.sin(a) * 0.42], r: [Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55] }));
  }
  return merge(parts);
}

/* ================================================================= AMAZON */

/** Toco toucan perched, facing -x: black body, white throat, huge orange bill. About 0.9 m tall. */
export function createToucan() {
  return merge([
    ball(0.3, '#1a1a1a', { p: [0.05, 0.4, 0], s: [1.0, 1.35, 0.9] }), // body
    ball(0.22, '#f4f0e0', { p: [-0.12, 0.62, 0], s: [0.8, 0.9, 0.9] }), // white throat
    ball(0.2, '#1a1a1a', { p: [-0.1, 0.78, 0] }), // head
    cone(0.12, 0.78, 5, '#ff9a1f', { p: [-0.52, 0.76, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.9] }), // bill
    cone(0.07, 0.22, 5, '#e63a1a', { p: [-0.93, 0.74, 0], r: [0, 0, Math.PI / 2] }), // bill tip
    ball(0.09, '#4fc3e8', { p: [-0.2, 0.84, 0.12] }), // blue eye ring
    ball(0.045, '#101010', { p: [-0.21, 0.84, 0.18] }),
    cone(0.12, 0.45, 4, '#1a1a1a', { p: [0.4, 0.2, 0], r: [0, 0, -Math.PI / 2 - 0.5], s: [1, 1, 0.5] }), // tail
    cone(0.05, 0.12, 4, '#ffd23f', { p: [0.1, 0.02, 0] }), // yellow rump
    cyl(0.025, 0.025, 0.12, 3, '#6a6a6a', { p: [0, 0.05, 0.08] }),
    cyl(0.025, 0.025, 0.12, 3, '#6a6a6a', { p: [0, 0.05, -0.08] }),
  ]);
}

/** Buttress roots flaring at the base of a kapok tree: six wide fins, about 1.4 m across and 1.1 m tall. */
export function createButtress() {
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push(box(0.1, 1.1, 0.7, '#b0823f', { p: [Math.cos(a) * 0.45, 0.45, Math.sin(a) * 0.45], r: [0, -a, 0.38 * (Math.cos(a) > 0 ? -1 : 1) * 0 - 0.0] }));
  }
  return merge(parts);
}

/** Emerald tree boa coiled round the end of a branch: green rings with white spots and a small head. About 1 unit across. */
export function createTreeBoa() {
  const green = '#4fd04a';
  const parts = [];
  for (let k = 0; k < 3; k++) {
    parts.push(part(new TorusGeometry(0.45 - k * 0.02, 0.09, 5, 10), green, { p: [0, -0.1 - k * 0.17, 0], r: [Math.PI / 2, 0, k * 0.5], s: [1, 1, 1] }));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + k;
      parts.push(ball(0.04, '#f4f0e0', { p: [Math.cos(a) * 0.5, -0.1 - k * 0.17 + 0.05, Math.sin(a) * 0.5] }));
    }
  }
  parts.push(ball(0.13, green, { p: [-0.5, -0.5, 0.2], s: [1.3, 0.9, 1] })); // head hanging
  parts.push(ball(0.035, '#ffd23f', { p: [-0.58, -0.47, 0.3] }));
  parts.push(cyl(0.07, 0.05, 0.4, 5, green, { p: [-0.42, -0.34, 0.18], r: [0, 0, 0.7] }));
  return merge(parts);
}

/** Jaguar crouched, facing -x: golden coat with black rosettes. About 2.5 m long, 1 m tall. */
export function createJaguar() {
  const gold = '#e0a73a';
  const rosette = '#2a1a0a';
  const parts = [
    ball(0.5, gold, { p: [0.4, 0.55, 0], s: [1.7, 0.8, 0.88] }),
    ball(0.3, gold, { p: [-0.92, 0.72, 0], s: [1, 1, 1] }),
    ball(0.16, '#f2e3c0', { p: [-1.15, 0.64, 0], s: [1.1, 0.7, 0.9] }),
    cone(0.08, 0.14, 4, gold, { p: [-0.88, 1.02, 0.15] }),
    cone(0.08, 0.14, 4, gold, { p: [-0.88, 1.02, -0.15] }),
    ball(0.04, '#101010', { p: [-1.1, 0.76, 0.14] }),
    ball(0.04, '#101010', { p: [-1.1, 0.76, -0.14] }),
    cyl(0.12, 0.14, 0.5, 5, gold, { p: [-0.5, 0.25, 0.24] }),
    cyl(0.12, 0.14, 0.5, 5, gold, { p: [-0.5, 0.25, -0.24] }),
    cyl(0.13, 0.15, 0.5, 5, gold, { p: [1.0, 0.25, 0.24] }),
    cyl(0.13, 0.15, 0.5, 5, gold, { p: [1.0, 0.25, -0.24] }),
    cyl(0.06, 0.08, 1.0, 5, gold, { p: [1.6, 0.6, 0], r: [0, 0, 1.05] }),
  ];
  for (let i = 0; i < 9; i++) {
    const x = -0.3 + (i % 5) * 0.32;
    const y = 0.7 + (i % 2) * 0.13 - 0.04 * (i % 3);
    parts.push(part(new TorusGeometry(0.075, 0.025, 4, 6), rosette, { p: [x, y, 0.4 - (i % 2) * 0.0], r: [0, 0, 0] }));
    parts.push(part(new TorusGeometry(0.075, 0.025, 4, 6), rosette, { p: [x + 0.1, y - 0.12, -0.4], r: [0, Math.PI, 0] }));
  }
  return merge(parts);
}

/** Green anaconda draped along the ground in S-bends, head facing -x. About 5 m long, 0.4 m high. */
export function createAnaconda() {
  const skin = '#7a9a3a';
  const blotch = '#2f4a1a';
  const parts = [];
  const N = 16;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const x = -2.4 + t * 4.8;
    const z = Math.sin(t * Math.PI * 3) * 0.28;
    const r = 0.2 - Math.abs(t - 0.45) * 0.12;
    parts.push(ball(Math.max(0.1, r), i % 3 === 1 ? blotch : skin, { p: [x, 0.2, z], s: [1.7, 0.9, 1] }));
  }
  parts.push(ball(0.19, skin, { p: [-2.6, 0.25, 0.1], s: [1.5, 0.8, 1.1] })); // head
  parts.push(ball(0.04, '#ffd23f', { p: [-2.7, 0.33, 0.24] }));
  parts.push(ball(0.04, '#ffd23f', { p: [-2.7, 0.33, -0.04] }));
  return merge(parts);
}

/** Three-toed sloth hanging upside down from a branch, about 1 m tall: grey-brown fur, pale face with a dark eye mask. Hangs from y = 0. */
export function createSloth() {
  const fur = '#9a8a6a';
  return merge([
    cyl(0.05, 0.05, 0.9, 4, '#6a4a2a', { p: [0, -0.02, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 1] }), // the branch it holds
    cyl(0.06, 0.05, 0.4, 4, fur, { p: [-0.18, -0.2, 0.05], r: [0, 0, 0.35] }), // arms up to the branch
    cyl(0.06, 0.05, 0.4, 4, fur, { p: [0.18, -0.2, 0.05], r: [0, 0, -0.35] }),
    ball(0.3, fur, { p: [0, -0.55, 0], s: [1.1, 1.2, 0.9] }), // body
    ball(0.19, '#e8dcc0', { p: [0, -0.9, 0.05] }), // face
    ball(0.075, '#3a2a1a', { p: [-0.08, -0.88, 0.17], s: [1.5, 0.8, 0.6] }), // eye mask
    ball(0.075, '#3a2a1a', { p: [0.08, -0.88, 0.17], s: [1.5, 0.8, 0.6] }),
    ball(0.03, '#101010', { p: [0, -0.95, 0.21] }),
    cyl(0.05, 0.05, 0.35, 4, fur, { p: [-0.2, -0.78, 0.1], r: [0, 0, -0.25] }), // dangling legs
    cyl(0.05, 0.05, 0.35, 4, fur, { p: [0.2, -0.78, 0.1], r: [0, 0, 0.25] }),
  ]);
}

/**
 * Blue morpho butterfly, wings spread, facing the viewer in the xy plane, radius about 1.1. The four wings are laid out
 * to cover a disc of radius 0.9 (so it is never smaller than the circle collider it stands for; a test samples it).
 * Exported polygons are used by that test.
 */
export const MORPHO_WINGS = Object.freeze({
  fore: [
    [0, 0.15],
    [0, 0.92],
    [0.5, 1.02],
    [1.0, 0.62],
    [1.12, 0.0],
    [0.05, -0.1],
  ],
  hind: [
    [0.0, -0.1],
    [1.12, 0.0],
    [0.92, -0.6],
    [0.46, -0.98],
    [0, -0.92],
  ],
});
export function createMorpho() {
  const parts = [];
  for (const [side, fn] of [[1, (p) => p], [-1, mirrorX]]) {
    for (const key of ['fore', 'hind']) {
      const pts = fn(MORPHO_WINGS[key]);
      // dark border behind, bright blue shrunk inside it, a pale iridescent streak on top
      parts.push(polygon(pts, '#10161e', -0.02));
      parts.push(polygon(pts.map(([x, y]) => [x * 0.86, y * 0.86 + (key === 'fore' ? 0.04 : -0.03)]), '#2f7bff', 0.0));
      parts.push(polygon(pts.map(([x, y]) => [x * 0.5, y * 0.5 + (key === 'fore' ? 0.14 : -0.1)]), '#7fd0ff', 0.02));
    }
    void side;
  }
  // wing veins and pale edge spots, so it reads as a butterfly and not a plain disc
  for (const sx of [1, -1]) {
    for (const [tx, ty] of [[0.95, 0.75], [1.05, 0.3], [1.0, -0.2], [0.8, -0.65], [0.4, -0.9], [0.4, 0.95]]) {
      const len = Math.hypot(tx, ty);
      const nx = (-ty / len) * 0.018;
      const ny = (tx / len) * 0.018;
      parts.push(polygon([[0.04 * sx, 0.02], [0.04 * sx + nx * sx, 0.02 + ny], [tx * 0.92 * sx + nx * sx, ty * 0.92 + ny], [tx * 0.92 * sx, ty * 0.92]], '#10161e', 0.03));
    }
    for (const [ex, ey] of [[1.0, 0.45], [1.08, 0.12], [1.0, -0.3], [0.7, -0.78], [0.3, -0.95], [0.3, 0.98]]) {
      parts.push(ball(0.035, '#ffffff', { p: [ex * 0.97 * sx, ey * 0.97, 0.04] }));
    }
  }
  parts.push(cyl(0.05, 0.05, 0.62, 5, '#10161e', { p: [0, 0.0, 0.03] })); // body
  parts.push(ball(0.07, '#10161e', { p: [0, 0.35, 0.03] }));
  parts.push(cyl(0.008, 0.008, 0.4, 3, '#10161e', { p: [-0.1, 0.5, 0.03], r: [0, 0, 0.5] }));
  parts.push(cyl(0.008, 0.008, 0.4, 3, '#10161e', { p: [0.1, 0.5, 0.03], r: [0, 0, -0.5] }));
  return merge(parts);
}
