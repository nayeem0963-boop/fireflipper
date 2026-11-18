/**
 * Zone obstacle tests. Run with: npm run test:obstacles
 * Sundarbans and Amazon obstacles are animals and plants of those regions (tigers, crocodiles, bats, beehives,
 * toucans, jaguars, sloths, a morpho butterfly...). This checks they stay honest: floating creatures are at least as
 * big as the circle collider they stand for, everything that reaches into a gap is modest, animals fit the slabs they
 * stand on, and the renderer's choice of look depends only on where the obstacle is.
 */
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { createObstacleStyle, OBSTACLE_STYLE_IDS, styleGeometries } from '../src/components/scene/obstacleStyles.js';
import { MORPHO_WINGS, createBeeCore } from '../src/components/scene/animalModels.js';
import { biomeAt, obstacleStyleAt, ROCK_RANGE } from '../src/systems/world/biomes.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** Smallest distance from the origin to any triangle's plane: the radius of the largest ball that fits inside. */
function inradius(geometry) {
  const p = geometry.attributes.position;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  let min = Infinity;
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    if (n.lengthSq() < 1e-12) continue;
    min = Math.min(min, Math.abs(n.normalize().dot(a)));
  }
  return min;
}
const extent = (g) => {
  g.computeBoundingBox();
  return g.boundingBox;
};
function inPolygon([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

check('three looks: two zones and the rock poles', OBSTACLE_STYLE_IDS.join() === 'sundarbans,amazon,rock');
check('unknown zone has no look (the original is used)', createObstacleStyle('nope') === null);

const W_MAX = 1.8; // the widest column the track generates
const MIN_SLAB = 7; // the shortest slab (passage tunnels are 7 to 12 m long)
const styles = Object.fromEntries(OBSTACLE_STYLE_IDS.map((id) => [id, createObstacleStyle(id)]));
const NAMES = { sundarbans: 'Sundarbans', amazon: 'Amazon', rock: 'Rock' };

for (const [id, st] of Object.entries(styles)) {
  const { geo, layout } = st;
  const label = NAMES[id];
  for (const g of styleGeometries(st)) check(`${label}: every geometry has vertex colours`, g.attributes.position.count > 0 && g.attributes.color?.count === g.attributes.position.count);
  const rockLook = id === 'rock'; // poles only: no slabs, animals or floating obstacles
  if (!rockLook) check(`${label}: two animals for the top of a lower slab`, geo.up.length === 2);

  // Animals standing on a slab: they fit, and stay low.
  for (const [i, u] of (geo.up ?? []).entries()) {
    const b = extent(u.geometry);
    check(`${label}: slab animal ${i} fits the shortest slab`, u.len <= MIN_SLAB - 1, u.len.toFixed(2));
    check(`${label}: slab animal ${i} is low (under 1.2 m)`, b.max.y <= 1.2 && b.min.y >= -0.1, `${b.min.y.toFixed(2)}..${b.max.y.toFixed(2)}`);
  }
  // Creatures hanging from an upper slab reach only a little into the gap.
  if (!rockLook) check(`${label}: hanging creature reaches under 1.2 m`, extent(geo.down).min.y >= -1.2, extent(geo.down).min.y.toFixed(2));

  // Column ends: what sits on a rising trunk / hangs from a hanging one, at the widest column.
  const up = extent(geo.capUp);
  const down = extent(geo.capDown);
  check(`${label}: plant or animal on a trunk top stays under 1.2 m`, up.max.y * layout.capUpScale * W_MAX <= 1.2, (up.max.y * layout.capUpScale * W_MAX).toFixed(2));
  check(`${label}: what hangs from a trunk reaches under 1.2 m`, -down.min.y * layout.capDownScale * W_MAX <= 1.2, (-down.min.y * layout.capDownScale * W_MAX).toFixed(2));
  const roots = extent(geo.base);
  check(`${label}: root flare stays low`, roots.max.y * layout.baseScale * W_MAX <= 2.0 && roots.min.y >= -0.2);
  // Growths along the pole: three kinds per zone, starting at the trunk's surface and spilling out a modest way.
  check(`${label}: ${rockLook ? 'two' : 'four'} kinds of pole growth`, geo.deco.length === (rockLook ? 2 : 4));
  for (const [i, g] of geo.deco.entries()) {
    const b = extent(g);
    check(`${label}: growth ${i} starts at the trunk and spills out under 1.3 m`, b.min.x >= -0.35 && b.max.x <= 1.3, `${b.min.x.toFixed(2)}..${b.max.x.toFixed(2)}`);
    check(`${label}: growth ${i} is under 1.8 m tall`, b.max.y - b.min.y <= 1.8, (b.max.y - b.min.y).toFixed(2));
  }
  check(`${label}: growths are dense enough to dress a pole`, layout.decoSpacing <= 1.2);
  // The ridged trunk / pillar: nothing may be narrower than the 0.4 half-width of the collider (ridges and facets push OUT or barely in),
  // and the widest point stays near one unit (the renderer stretches it to the pole's width).
  geo.column.computeBoundingBox();
  const wx = geo.column.boundingBox.max.x - geo.column.boundingBox.min.x;
  check(`${label}: pole body is about full width`, wx >= 0.9 && wx <= 1.25, wx.toFixed(2));
  const pos = geo.column.attributes.position;
  let narrow = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    if (r > 0.1) narrow = Math.min(narrow, r); // the side vertices (the end-cap centres sit on the axis)
  }
  // vertices on the narrow (top) end are the smallest radius; the faces between them are at least cos(pi/sides) of that
  const sides = id === 'rock' ? 7 : 14;
  check(`${label}: pole body covers its 0.4 hitbox`, narrow * Math.cos(Math.PI / sides) >= 0.4 - 1e-6, (narrow * Math.cos(Math.PI / sides)).toFixed(3));
}

// Floating obstacles (circle colliders of 0.86 of the rock radius): the creature must cover at least that, and is drawn at 1.05 r.
check('the rock look has no slab animals or floating obstacles', !styles.rock.geo.up && !styles.rock.geo.rock && !styles.rock.geo.block);
const core = createBeeCore();
check('Sundarbans: the bee swarm core is never inside the 0.86 hitbox', inradius(core) * 1.05 >= 0.86, inradius(core).toFixed(3));
const wings = [MORPHO_WINGS.fore, MORPHO_WINGS.hind].flatMap((w) => [w, w.map(([x, y]) => [-x, y])]);
let uncovered = 0;
for (const radius of [0.5, 0.7, 0.86 / 1.05]) {
  for (let k = 0; k < 720; k++) {
    const a = (k / 720) * Math.PI * 2;
    const pt = [Math.cos(a) * radius, Math.sin(a) * radius];
    if (!wings.some((poly) => inPolygon(pt, poly))) uncovered++;
  }
}
check('Amazon: the morpho butterfly covers its whole 0.86 hitbox disc', uncovered === 0, `${uncovered} sample points uncovered`);
// The rock range: 500 to 1000 m, poles only.
check('rock range is 500 to 1000 m', ROCK_RANGE.start === 500 && ROCK_RANGE.end === 1000);
check('obstacle look by position', obstacleStyleAt(0) === 'sundarbans' && obstacleStyleAt(499.9) === 'sundarbans' && obstacleStyleAt(500) === 'rock' && obstacleStyleAt(750) === 'rock' && obstacleStyleAt(999.9) === 'rock' && obstacleStyleAt(1000) === 'amazon' && obstacleStyleAt(1499.9) === 'amazon' && obstacleStyleAt(1500) === null && obstacleStyleAt(5000) === null);
check('Amazon: the morpho does not spin (it always faces the viewer)', styles.amazon.layout.rockSpin === false);


// The look is chosen by the obstacle's own track position; colliders and the simulation never see any of it.
check('look follows position', biomeAt(250)?.id === 'sundarbans' && biomeAt(750)?.id === 'volcano' && biomeAt(1250)?.id === 'amazon');
const field = read('src/components/scene/ObstacleField.jsx');
check('renderer picks the look from the obstacle position', /obstacleStyleAt\(o\.x\)/.test(field));
check('between the zones only poles are rock (slabs and rocks keep the original look)', /style === 'rock' && o\.kind !== 'column'/.test(field));
check('unused looks are hidden (no draw cost)', /mesh\.visible = count > 0/.test(field));
check('the renderer dresses poles with the growths', /deco\$\{variant\}/.test(field) && /DECO_REACH/.test(field));
check('simulation does not import obstacle looks', !/obstacleStyles|animalModels|ObstacleField/.test(read('src/systems/game/createGameSim.js') + read('src/systems/obstacles/spawner.js') + read('src/systems/obstacles/patterns.js') + read('src/systems/physics/collision.js')));

console.log(failures ? `\n${failures} failed` : '\nobstacle tests passed');
process.exit(failures ? 1 : 0);
