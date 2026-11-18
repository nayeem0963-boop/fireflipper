import { BoxGeometry, BufferAttribute, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, IcosahedronGeometry, Matrix4, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BIOMES } from '../../systems/world/biomes.js';
import { paint, place } from '../../scenes/EmberValley/mangroveGeometry.js';

/**
 * Obstacle looks for the scenery zones: each zone gets its own shapes, so the Sundarbans and the Amazon feel like
 * different places to fly through. They replace only how an obstacle is DRAWN: the colliders (box hw/hh, circle cr)
 * are untouched, and every shape stays at least as big as its collider so nothing ever hits you before you touch it.
 *
 * Every style is a set of small merged geometries with vertex colours (built once, instanced per obstacle):
 *   column    the body, stretched to the column's height (a plain tapered cylinder, so stretching looks natural)
 *   capUp     the detail at the top end (shown when the gap is above the column: a rising column)
 *   capDown   the detail at the bottom end (a hanging column)
 *   block     a wide slab body
 *   blockCap  the slab's gap-facing edge
 *   rock      a floating rock
 * Caps are unlit and bright, like the original glowing caps, so the corridor edge always reads at a glance.
 *
 *   Sundarbans: mangrove trunks with a lime leaf crown above / a hanging tangle of aerial roots below, mud-bank slabs
 *               edged with boardwalk planks, and knotted driftwood root-balls.
 *   Amazon:     rainforest trunks with a red-orange bromeliad rosette above / hanging liana tassels below, fallen-log
 *               slabs edged with moss, and moss-capped boulders.
 */

/** Deterministic 0..1 from a position (same position, same value, so shared vertices move together). */
function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** A rough, lumpy ball (like a root-ball or boulder) with vertex colours chosen per vertex by `colorAt`. */
function lumpyBall({ detail = 1, lump, colorAt }) {
  const base = new IcosahedronGeometry(1, detail);
  const p = base.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    // Lumps only ever push OUT, so the surface is never inside the rock's hitbox (a hit always looks like a touch).
    const k = 1 + hash3(x, y, z) * lump;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  const g = base.index ? base.toNonIndexed() : base;
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    c.set(colorAt(pos.getX(i), pos.getY(i), pos.getZ(i)));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
}

/** Strips of a slab along x (each a box), coloured one by one: planks, moss patches. */
function strips(colors, { height = 1, depth = 1 } = {}) {
  const n = colors.length;
  return mergeGeometries(
    colors.map((hex, i) => paint(place(new BoxGeometry(1 / n - 0.012, height, depth), { position: [-0.5 + (i + 0.5) / n, 0, 0] }), hex)),
    false,
  );
}

/** A tapered body, 1 unit tall, unit diameter (the instance matrix stretches it to the column). */
function body(sides, topScale, color) {
  return paint(place(new CylinderGeometry(0.5 * topScale, 0.5, 1, sides), {}), color);
}

function sundarbansStyle() {
  const S = BIOMES.sundarbans.scene;
  const lime = S.column.cap;
  const limeDark = '#9fd95a';
  // Rising column: a mangrove with a flat leaf crown over its top end (stays within the column's width, plus a little).
  const capUp = mergeGeometries(
    [
      paint(place(new DodecahedronGeometry(0.5, 0), { position: [0, 0.02, 0], scale: [1.0, 0.5, 1.0] }), lime),
      paint(place(new DodecahedronGeometry(0.34, 0), { position: [-0.2, 0.1, 0.12], rotation: [0.4, 0.9, 0], scale: [1, 0.55, 1] }), limeDark),
      paint(place(new DodecahedronGeometry(0.3, 0), { position: [0.22, 0.08, -0.1], rotation: [0.2, 1.7, 0], scale: [1, 0.55, 1] }), lime),
    ],
    false,
  );
  // Hanging column: aerial roots drooping from its bottom end like a beard of pale spikes.
  const roots = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = i === 0 ? 0 : 0.3;
    roots.push(
      paint(
        place(new ConeGeometry(0.07, 0.3 + (i % 3) * 0.05, 4), {
          position: [Math.cos(a) * r, -0.15 - (i % 3) * 0.025, Math.sin(a) * r],
          rotation: [Math.PI, 0, 0],
        }),
        i % 2 ? '#e9d7a0' : '#f4e6b4',
      ),
    );
  }
  const capDown = mergeGeometries(roots, false);
  return {
    column: body(7, 0.92, S.column.color),
    capUp,
    capDown,
    block: paint(place(new BoxGeometry(1, 1, 1), {}), S.block.color),
    blockCap: strips(['#e0b878', '#cfa56a', '#e8c488', '#d4ac70', '#e2bc7c', '#c89c62']),
    rock: lumpyBall({
      lump: 0.16,
      colorAt: (x, y, z) => {
        const t = hash3(x * 3, y * 3, z * 3);
        return t > 0.78 ? '#4a3322' : t > 0.4 ? S.rock.color : '#b49266';
      },
    }),
    // dark spikes (root stubs) poke out of the root-ball
    rockSpikes: true,
  };
}

function amazonStyle() {
  const S = BIOMES.amazon.scene;
  // Rising column: a bromeliad rosette of red-orange leaves around a pale-yellow heart, perched on the trunk's top.
  const leaves = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    leaves.push(
      paint(
        place(new ConeGeometry(0.11, 0.55, 4), {
          position: [Math.cos(a) * 0.2, 0.06, Math.sin(a) * 0.2],
          rotation: [Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0],
        }),
        i % 2 ? '#ff6a2a' : '#ff8a3a',
      ),
    );
  }
  leaves.push(paint(place(new DodecahedronGeometry(0.2, 0), { position: [0, 0.04, 0], scale: [1, 0.7, 1] }), S.column.cap));
  const capUp = mergeGeometries(leaves, false);
  // Hanging column: liana tassels, long green strands with pale-yellow tips.
  const lianas = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = i === 0 ? 0 : 0.28;
    const len = 0.28 + (i % 3) * 0.06;
    lianas.push(paint(place(new CylinderGeometry(0.018, 0.018, len, 3), { position: [Math.cos(a) * r, -len / 2, Math.sin(a) * r] }), '#5aa03a'));
    lianas.push(paint(place(new DodecahedronGeometry(0.06, 0), { position: [Math.cos(a) * r, -len - 0.03, Math.sin(a) * r] }), S.column.cap));
  }
  const capDown = mergeGeometries(lianas, false);
  return {
    column: body(8, 1.0, S.column.color),
    capUp,
    capDown,
    block: paint(place(new BoxGeometry(1, 1, 1), {}), S.block.color),
    blockCap: strips(['#7bbf46', '#5fa83a', '#8ccc50', '#6db840', '#9bd45a', '#56a038']),
    rock: lumpyBall({
      lump: 0.1,
      colorAt: (x, y, z) => {
        const mossy = y / Math.hypot(x, y, z) > 0.62 + (hash3(x * 4, y * 4, z * 4) - 0.5) * 0.2;
        return mossy ? '#6aa044' : hash3(x * 3, y * 3, z * 3) > 0.7 ? '#8e7e5a' : S.rock.color;
      },
    }),
    rockSpikes: false,
  };
}

/** Root stubs around a driftwood ball, merged with the ball so it stays one geometry. */
function addSpikes(ball) {
  const spikes = [];
  const up = new Vector3(0, 1, 0);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.399; // golden angle spreads them evenly
    const y = ((i * 0.37) % 1) * 1.4 - 0.7;
    const r = Math.sqrt(1 - y * y);
    const dir = new Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    const g = paint(new ConeGeometry(0.1, 0.34, 4), '#3a2616');
    g.applyMatrix4(new Matrix4().compose(dir.clone().multiplyScalar(1.02), new Quaternion().setFromUnitVectors(up, dir), new Vector3(1, 1, 1)));
    spikes.push(g);
  }
  return mergeGeometries([ball, ...spikes], false);
}

const BUILDERS = { sundarbans: sundarbansStyle, amazon: amazonStyle };

/** Geometries for a zone's obstacle style, or null for the original look. The caller owns (and disposes) them. */
export function createObstacleStyle(zoneId, { spikes = true } = {}) {
  const build = BUILDERS[zoneId];
  if (!build) return null;
  const s = build();
  const { rockSpikes, ...geos } = s;
  if (rockSpikes && spikes) geos.rock = addSpikes(geos.rock);
  return geos;
}

export const OBSTACLE_STYLE_IDS = Object.freeze(Object.keys(BUILDERS));
