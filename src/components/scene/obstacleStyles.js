import { BoxGeometry, BufferAttribute, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BIOMES } from '../../systems/world/biomes.js';
import { paint, place } from '../../scenes/EmberValley/mangroveGeometry.js';
import * as A from './animalModels.js';

/**
 * Obstacle looks for the scenery zones: animals and plants of each region instead of plain columns, slabs and rocks.
 * They replace only how an obstacle is DRAWN: the colliders (box hw/hh, circle cr) are untouched, so physics,
 * fairness and the track are identical in every zone. Each look is a set of small merged geometries with vertex colours,
 * built once and instanced per obstacle. Every shape stays at least as big as its collider.
 *
 *   Rock         (500 to 1000 m, poles only) jagged stone pillars with glowing crystal shards at the tip, scree at the foot and
 *                angular outcrops; tinted by the theme. Slabs and rocks there keep the original look.
 *   Sundarbans   Sundari mangrove (stilt roots, leaf crown) / wild honey hive hanging from a branch /
 *                Bengal tiger or saltwater crocodile on a mud bank / fruit bats roosting under an overhang /
 *                a swarm of angry bees.
 *   Amazon       kapok tree (buttress roots) with a toco toucan perched on top / emerald tree boa coiled round a branch /
 *                jaguar or green anaconda on a fallen log / three-toed sloths hanging from a branch /
 *                a blue morpho butterfly.
 *
 * `geo`    the geometries: column (trunk body), base (roots at the water / ground line, rising columns only), capUp (on
 *          the top end of a rising column), capDown (on the bottom end of a hanging column), block (slab body),
 *          blockCap (the slab's gap-facing edge), up[] (animals on top of a lower slab; `len` is how long each is),
 *          down (a creature hanging from an upper slab), rock (a floating obstacle), deco[] (plants and growths that spill
 *          out of the trunk all along a pole: branches, combs, roots / bromeliads, lianas, fungi).
 * `layout` how the renderer places them.
 */

/** Strips of a slab along x (each a box), coloured one by one: planks, moss patches. */
function strips(colors, { height = 1, depth = 1 } = {}) {
  const n = colors.length;
  return mergeGeometries(
    colors.map((hex, i) => paint(place(new BoxGeometry(1 / n - 0.012, height, depth), { position: [-0.5 + (i + 0.5) / n, 0, 0] }), hex)),
    false,
  );
}

/** Deterministic 0..1 from an integer, so a trunk or pillar always has the same ridges. */
const h1 = (n) => {
  const v = Math.sin(n * 91.7 + 13.3) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * A tree trunk, 1 unit tall and about 1 across (the instance matrix stretches it to the pole): a many-sided tapered
 * cylinder whose sides are ridged bark, each ridge pushed in or out a little and shaded dark, mid or light. The ridges run
 * the length of the trunk, so stretching it keeps them looking natural. The ridges never go in far enough to be inside the
 * collider: the narrowest part is still 0.4 * the width.
 */
function trunkBody(color, { sides = 14, topScale = 0.9, ridge = 0.07 } = {}) {
  const g = new CylinderGeometry(0.5 * topScale, 0.5, 1, sides, 1);
  const p = g.attributes.position;
  const base = new Color(color);
  const colors = new Float32Array(p.count * 3);
  const c = new Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const idx = Math.round(((a + Math.PI) / (Math.PI * 2)) * sides) % sides;
    const bulge = h1(idx * 3.7); // 0..1 per ridge
    const k = 1 - ridge * 0.5 + ridge * bulge; // 0.965..1.035 of the radius at ridge = 0.07
    if (Math.hypot(x, z) > 1e-6) p.setXYZ(i, x * k, p.getY(i), z * k);
    const shade = 0.8 + bulge * 0.34; // dark in the grooves, light on the ridges
    c.copy(base).multiplyScalar(shade);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

/**
 * The rock look for poles between the two zones (500 to 1000 m): jagged stone pillars with crystal shards at the tip,
 * scree at the foot and angular outcrops jutting from the sides. Geometry is grey-scale (shades only); the renderer tints it with
 * the theme's column colour and lights the shards with the theme's cap colour, so it fits Ember Valley and Frost Cavern alike.
 */
function rockStyle() {
  const shade = (v) => new Color(v, v, v).getStyle();
  const grey = (v, geo) => paint(geo, shade(v));
  // Pillar: a 7-sided tapered stone column; each facet is pushed OUT by a different amount (never in), shaded like strata.
  const pillar = (() => {
    const g = new CylinderGeometry(0.5 * 0.92, 0.5, 1, 7, 1); // 7 sides: the flat faces sit at cos(pi/7) of the radius, so the top stays wide enough to cover the 0.4 hitbox
    const p = g.attributes.position;
    const colors = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const idx = Math.round(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 7) % 7;
      const out = 1 + h1(idx * 5.3) * 0.2; // outward only
      if (Math.hypot(x, z) > 1e-6) p.setXYZ(i, x * out, p.getY(i), z * out);
      const v = 0.72 + h1(idx * 2.9) * 0.4;
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = v;
    }
    g.setAttribute('color', new BufferAttribute(colors, 3));
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    return g;
  })();
  // Crystal shards at the gap end of a pole, all the same colour (the theme's cap colour, unlit so they glow).
  const shards = (dir) => {
    const parts = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const r = i === 0 ? 0 : 0.28;
      const len = 0.42 + (i % 3) * 0.1;
      parts.push(
        grey(
          1,
          place(new ConeGeometry(0.09 + (i === 0 ? 0.03 : 0), len, 4), {
            position: [Math.cos(a) * r, dir * (len / 2 - 0.05), Math.sin(a) * r],
            rotation: [dir < 0 ? Math.PI : 0, 0, Math.cos(a) * 0.35 * dir],
          }),
        ),
      );
    }
    return mergeGeometries(parts, false);
  };
  // Scree: a spill of angular boulders at the foot of a rising pillar.
  const scree = mergeGeometries(
    [
      [0.55, 0.2, 0, 0.36],
      [-0.5, 0.15, 0.2, 0.3],
      [0.1, 0.12, -0.5, 0.28],
      [-0.2, 0.1, 0.5, 0.24],
      [0.65, 0.08, 0.45, 0.2],
    ].map(([x, y, z, r], i) => grey(0.7 + (i % 3) * 0.15, place(new DodecahedronGeometry(r, 0), { position: [x, y, z], rotation: [i, i * 1.7, 0], scale: [1.15, 0.8, 1.1] }))),
    false,
  );
  // Outcrops spilling out along a pole: an angular chunk, and a cluster of stone spikes.
  const outcrop = mergeGeometries(
    [
      grey(0.9, place(new DodecahedronGeometry(0.32, 0), { position: [0.28, 0, 0], rotation: [0.4, 0.9, 0.3], scale: [1.4, 0.9, 1] })),
      grey(0.7, place(new DodecahedronGeometry(0.2, 0), { position: [0.62, 0.18, 0.05], rotation: [0.9, 0.2, 0.5], scale: [1.2, 0.9, 1] })),
      grey(1.0, place(new DodecahedronGeometry(0.16, 0), { position: [0.45, -0.28, 0.08], rotation: [0.2, 1.3, 0.1] })),
    ],
    false,
  );
  const spikes = mergeGeometries(
    [0, 1, 2, 3].map((i) =>
      grey(0.75 + (i % 2) * 0.25, place(new ConeGeometry(0.11, 0.7 + i * 0.12, 5), { position: [0.18 + i * 0.2, 0.05 - i * 0.04, (i - 1.5) * 0.08], rotation: [0, 0, -1.1 + i * 0.12] })),
    ),
    false,
  );
  return {
    geo: { column: pillar, base: scree, capUp: shards(1), capDown: shards(-1), deco: [outcrop, spikes] },
    layout: { baseScale: 1.0, capUpScale: 1.0, capDownScale: 1.0, decoSpacing: 1.1 },
  };
}

function sundarbansStyle() {
  const S = BIOMES.sundarbans.scene;
  const lime = S.column.cap;
  const limeDark = '#9fd95a';
  // The Sundari's leaf crown: a flat mass of lime leaves over the top of the trunk.
  const crown = mergeGeometries(
    [
      paint(place(new DodecahedronGeometry(0.5, 0), { position: [0, 0.02, 0], scale: [1.0, 0.5, 1.0] }), lime),
      paint(place(new DodecahedronGeometry(0.34, 0), { position: [-0.2, 0.1, 0.12], rotation: [0.4, 0.9, 0], scale: [1, 0.55, 1] }), limeDark),
      paint(place(new DodecahedronGeometry(0.3, 0), { position: [0.22, 0.08, -0.1], rotation: [0.2, 1.7, 0], scale: [1, 0.55, 1] }), lime),
    ],
    false,
  );
  return {
    geo: {
      column: trunkBody(S.column.color, { sides: 14, topScale: 0.9, ridge: 0.08 }),
      base: A.createStiltRoots(),
      capUp: crown,
      capDown: A.createHoneyHive(),
      block: paint(place(new BoxGeometry(1, 1, 1), {}), S.block.color),
      blockCap: strips(['#e0b878', '#cfa56a', '#e8c488', '#d4ac70', '#e2bc7c', '#c89c62']),
      up: [animal(A.createTiger()), animal(A.createCrocodile())],
      down: A.createFruitBat(),
      rock: A.createBeeSwarm(),
      deco: [A.createMangroveBranch(), A.createCombCluster(), A.createTrunkKnot('#4a3322', '#c4f27a'), A.createAerialRoots()],
    },
    layout: { baseScale: 1.0, capUpScale: 1.0, capDownScale: 0.55, downSpacing: 2.3, rockSpin: true, decoSpacing: 1.05 },
  };
}

function amazonStyle() {
  const S = BIOMES.amazon.scene;
  return {
    geo: {
      column: trunkBody(S.column.color, { sides: 14, topScale: 0.94, ridge: 0.07 }),
      base: A.createButtress(),
      capUp: A.createToucan(),
      capDown: A.createTreeBoa(),
      block: paint(place(new BoxGeometry(1, 1, 1), {}), S.block.color),
      blockCap: strips(['#7bbf46', '#5fa83a', '#8ccc50', '#6db840', '#9bd45a', '#56a038']),
      up: [animal(A.createJaguar()), animal(A.createAnaconda())],
      down: A.createSloth(),
      rock: A.createMorpho(),
      deco: [A.createBromeliad(), A.createLianaCurtain(), A.createTrunkKnot('#7a5538', '#5fa83a'), A.createBracketFungi()],
    },
    layout: { baseScale: 1.0, capUpScale: 0.6, capDownScale: 0.95, downSpacing: 3.4, rockSpin: false, decoSpacing: 1.1 },
  };
}

const BUILDERS = { sundarbans: sundarbansStyle, amazon: amazonStyle, rock: rockStyle };

/** An animal for the top of a slab: its geometry, how long it is, and where its middle is (so it can be centred). */
function animal(geometry) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  return { geometry, len: max.x - min.x, center: (max.x + min.x) / 2 };
}

/** Geometries and layout for a zone's obstacle look, or null for the original look. The caller owns (and disposes) the geometries. */
export function createObstacleStyle(zoneId) {
  const build = BUILDERS[zoneId];
  return build ? build() : null;
}

/** Every geometry in a style (for disposal). */
export function styleGeometries(style) {
  const { up = [], deco = [], ...rest } = style.geo;
  return [...Object.values(rest), ...up.map((u) => u.geometry), ...deco];
}

export const OBSTACLE_STYLE_IDS = Object.freeze(Object.keys(BUILDERS));
