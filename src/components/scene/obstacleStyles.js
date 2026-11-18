import { BoxGeometry, CylinderGeometry, DodecahedronGeometry } from 'three';
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
 *          down (a creature hanging from an upper slab), rock (a floating obstacle).
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

/** A tapered body, 1 unit tall, unit diameter (the instance matrix stretches it to the column). */
function body(sides, topScale, color) {
  return paint(place(new CylinderGeometry(0.5 * topScale, 0.5, 1, sides), {}), color);
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
      column: body(7, 0.92, S.column.color),
      base: A.createStiltRoots(),
      capUp: crown,
      capDown: A.createHoneyHive(),
      block: paint(place(new BoxGeometry(1, 1, 1), {}), S.block.color),
      blockCap: strips(['#e0b878', '#cfa56a', '#e8c488', '#d4ac70', '#e2bc7c', '#c89c62']),
      up: [animal(A.createTiger()), animal(A.createCrocodile())],
      down: A.createFruitBat(),
      rock: A.createBeeSwarm(),
    },
    layout: { baseScale: 1.0, capUpScale: 1.0, capDownScale: 0.55, downSpacing: 2.3, rockSpin: true },
  };
}

function amazonStyle() {
  const S = BIOMES.amazon.scene;
  return {
    geo: {
      column: body(8, 1.0, S.column.color),
      base: A.createButtress(),
      capUp: A.createToucan(),
      capDown: A.createTreeBoa(),
      block: paint(place(new BoxGeometry(1, 1, 1), {}), S.block.color),
      blockCap: strips(['#7bbf46', '#5fa83a', '#8ccc50', '#6db840', '#9bd45a', '#56a038']),
      up: [animal(A.createJaguar()), animal(A.createAnaconda())],
      down: A.createSloth(),
      rock: A.createMorpho(),
    },
    layout: { baseScale: 1.0, capUpScale: 0.6, capDownScale: 0.95, downSpacing: 3.4, rockSpin: false },
  };
}

const BUILDERS = { sundarbans: sundarbansStyle, amazon: amazonStyle };

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
  const { up, ...rest } = style.geo;
  return [...Object.values(rest), ...up.map((u) => u.geometry)];
}

export const OBSTACLE_STYLE_IDS = Object.freeze(Object.keys(BUILDERS));
