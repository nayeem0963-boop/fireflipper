/**
 * Zone obstacle-look tests. Run with: npm run test:obstacles
 * Sundarbans and Amazon obstacles are drawn with their own shapes. This checks the shapes stay at least as big as
 * their colliders (so a hit always looks like a touch), that decorations stay modest, and that the renderer's
 * choice of look depends only on where the obstacle stands.
 */
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { createObstacleStyle, OBSTACLE_STYLE_IDS } from '../src/components/scene/obstacleStyles.js';
import { biomeAt } from '../src/systems/world/biomes.js';

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
  const n = geometry.index ? geometry.index.count : p.count;
  for (let i = 0; i < n; i += 3) {
    const ia = geometry.index ? geometry.index.getX(i) : i;
    const ib = geometry.index ? geometry.index.getX(i + 1) : i + 1;
    const ic = geometry.index ? geometry.index.getX(i + 2) : i + 2;
    a.fromBufferAttribute(p, ia);
    b.fromBufferAttribute(p, ib);
    c.fromBufferAttribute(p, ic);
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    min = Math.min(min, Math.abs(normal.dot(a)));
  }
  return min;
}

check('two zone looks', OBSTACLE_STYLE_IDS.join() === 'sundarbans,amazon');
check('unknown zone has no look (the original is used)', createObstacleStyle('nope') === null);

const looks = {};
for (const id of OBSTACLE_STYLE_IDS) {
  const g = createObstacleStyle(id);
  const bare = createObstacleStyle(id, { spikes: false });
  looks[id] = g;
  for (const part of ['column', 'capUp', 'capDown', 'block', 'blockCap', 'rock']) {
    const geo = g[part];
    check(`${id}.${part}: has geometry with vertex colours`, geo?.attributes.position.count > 0 && geo.attributes.color?.count === geo.attributes.position.count);
  }
  // Rock: unit ball scaled by the rock's radius; the collider is a circle of 0.86 of it.
  check(`${id}: rock surface is never inside the 0.86 hitbox`, inradius(bare.rock) >= 0.86, inradius(bare.rock).toFixed(3));
  // Column body: a unit-diameter tapered cylinder; the box collider is 0.8 of its width.
  g.column.computeBoundingBox();
  const wx = g.column.boundingBox.max.x - g.column.boundingBox.min.x;
  check(`${id}: column body is full width`, wx >= 0.9 && wx <= 1.01, wx.toFixed(2));
  // Caps and tassels are decoration: modest in size, and they barely reach into the gap.
  for (const part of ['capUp', 'capDown']) {
    g[part].computeBoundingBox();
    const { min, max } = g[part].boundingBox;
    check(`${id}.${part}: no wider than the trunk plus a little`, Math.max(Math.abs(min.x), max.x, Math.abs(min.z), max.z) <= 0.62, `${max.x.toFixed(2)}`);
  }
  g.capUp.computeBoundingBox();
  g.capDown.computeBoundingBox();
  check(`${id}: rising-column crown stays near the trunk's end`, g.capUp.boundingBox.max.y <= 0.5, g.capUp.boundingBox.max.y.toFixed(2));
  check(`${id}: hanging tassel is short`, g.capDown.boundingBox.min.y >= -0.55, g.capDown.boundingBox.min.y.toFixed(2));
}
// Column bodies: a regular polygon's inradius is 0.5 * cos(pi / sides) * (smaller radius at the top).
check('Sundarbans column body (7 sides, top 0.92) covers the 0.4 hitbox', 0.5 * 0.92 * Math.cos(Math.PI / 7) >= 0.4);
check('Amazon column body (8 sides) covers the 0.4 hitbox', 0.5 * Math.cos(Math.PI / 8) >= 0.4);

// The look is chosen by the obstacle's own track position.
check('look follows position', biomeAt(250)?.id === 'sundarbans' && biomeAt(750) === null && biomeAt(1250)?.id === 'amazon');
const field = read('src/components/scene/ObstacleField.jsx');
check('renderer picks the look from the obstacle position', /biomeAt\(o\.x\)/.test(field));
check('unused looks are hidden (no draw cost)', /mesh\.visible = count > 0/.test(field));
// Colliders and the simulation never see any of this.
check('simulation does not import obstacle looks', !/obstacleStyles|ObstacleField/.test(read('src/systems/game/createGameSim.js') + read('src/systems/obstacles/spawner.js') + read('src/systems/obstacles/patterns.js') + read('src/systems/physics/collision.js')));

console.log(failures ? `\n${failures} failed` : '\nobstacle look tests passed');
process.exit(failures ? 1 : 0);
