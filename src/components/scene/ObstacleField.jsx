import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, DoubleSide, Object3D } from 'three';
import { WORLD } from '../../systems/physics/constants.js';
import { ACTIVE_OBSTACLE_LOOKS, BIOMES, obstacleStyleAt } from '../../systems/world/biomes.js';
import { useTheme } from '../../hooks/useTheme.js';
import { createObstacleStyle, styleGeometries } from './obstacleStyles.js';
import { createCanyonRockSet } from './canyonRocks.js';

/** Deterministic 0..1 from a number, so an obstacle always picks the same animal and spot. */
const hash = (n) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Renders every pooled obstacle with a few InstancedMeshes per look, so the whole obstacle field stays at a handful
 * of draw calls no matter how many obstacles are alive. Instance matrices are rewritten each frame from simulation
 * data; nothing is allocated per frame.
 *
 * Each obstacle is drawn in the look of the scenery zone it stands in (chosen by its own track position): the original look (coloured by the
 * theme), or the original shapes recoloured for the zone (canyon, celestial, palace). Looks with their own shapes (the retired Sundarbans / Amazon
 * animals and plants and the rock pillars, see obstacleStyles.js) are built only if listed in ACTIVE_OBSTACLE_LOOKS. Only the drawing differs: colliders never change.
 * Meshes with nothing to draw are hidden, so a look costs nothing when it is not on screen.
 */
const MAX = { column: 48, block: 12, rock: 112, up: 16, down: 48, deco: 192 };
/** The canyon's rock pieces (components/scene/canyonRocks.js), one instanced mesh each: how many can be drawn at once. */
const ROCK_MAX = { hoodooHead: 24, hoodooSegment: 48, lintelHead: 24, lintelSegment: 48, finHeadUp: 24, finHeadDown: 24, finBody: 48, archBand: 12, ledgeBand: 12, slabBlock: 72, boulder: 112 };
const BAND_HEIGHT = 1.2; // the arch and ledge bands are 1.2 tall; the slab's body (stacked 3-tall blocks) continues from there
const BLOCK_HEIGHT = 3;
/** How much of a pole is dressed (metres from the gap end): the rest is off screen or under the water / ground. */
const DECO_REACH = 9;
const CAP_THICKNESS = 0.14;
/**
 * Zones that keep the original obstacle shapes but recolour them (see systems/world/biomes.js): zone id -> the id of its 'tinted' mesh set.
 * Each set is the six original meshes in the zone's own colours.
 */
const TINTED_ZONES = Object.freeze({ canyon: BIOMES.canyon.scene, celestial: BIOMES.celestial.scene, palace: BIOMES.palace.scene });
/** Zone caps are a little taller than the flat original ones so their shapes read; still inside the corridor edge. */
const ZONE_CAP = 1.0;

export default function ObstacleField({ sim }) {
  const { scene } = useTheme();
  const dummy = useMemo(() => new Object3D(), []);

  // refs[style][part] -> InstancedMesh. 'default' has one shared cap mesh; zone styles have separate up / down caps.
  const refs = useRef({});
  const reg = (style, part) => (m) => {
    (refs.current[style] ??= {})[part] = m;
  };
  // Looks with their own shapes (animals, plants, pillars) are only built when a track range is mapped to them (none are, now: see ACTIVE_OBSTACLE_LOOKS).
  const styles = useMemo(() => Object.fromEntries(ACTIVE_OBSTACLE_LOOKS.map((id) => [id, createObstacleStyle(id)])), []);
  useEffect(() => () => Object.values(styles).forEach((st) => styleGeometries(st).forEach((g) => g.dispose())), [styles]);
  // The canyon's hoodoos, fins, arches, ledges and boulders (before 1500 m): drawn from the lists the simulation worked out when each obstacle spawned.
  const rocks = useMemo(() => createCanyonRockSet(), []);
  useEffect(() => () => Object.values(rocks).forEach((g) => g.dispose()), [rocks]);

  useFrame(() => {
    const def = refs.current.default;
    if (!def?.column) return;
    const dist = sim.renderDistance();
    const t = sim.time;
    // per (style, part) write index
    const n = {};
    const next = (style, part) => (n[`${style}.${part}`] = (n[`${style}.${part}`] ?? 0) + 1) - 1;
    const rockSet = refs.current.rocks;
    /** Writes one instance of a canyon rock piece (no spin: the outlines are tested as drawn). */
    const putRock = (key, px, py, sx, sy, sz, pz = 0) => {
      const i = next('rocks', key);
      if (i >= ROCK_MAX[key]) return;
      dummy.position.set(px, py, pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      rockSet[key].setMatrixAt(i, dummy.matrix);
    };
    const drawRock = (o, x) => {
      if (!rockSet) return;
      if (o.kind === 'rock') {
        // a boulder: a round faceted lump, uniform scale (its collider circle sits inside it), free to spin
        const i = next('rocks', 'boulder');
        if (i >= ROCK_MAX.boulder) return;
        dummy.position.set(x, o.y, o.z);
        dummy.rotation.set(o.rot + t * o.spin, o.rot * 1.3 + t * o.spin * 0.7, o.rot * 0.5);
        dummy.scale.setScalar(o.r);
        dummy.updateMatrix();
        rockSet.boulder.setMatrixAt(i, dummy.matrix);
      } else if (o.kind === 'column') {
        const list = o.draw;
        if (list) for (let k = 0; k < list.length; k++) putRock(list[k].key, x, list[k].y, list[k].s, list[k].sy, list[k].s);
      } else if (o.look === 'arch') {
        // an arch span: the band at the gap face (curved underside), then stacked blocks up to the top of the screen (beyond the ceiling nothing can be reached)
        const yb = o.y - o.h / 2;
        putRock('archBand', x, yb, o.w, 1, o.d);
        const reach = Math.min(o.h - BAND_HEIGHT, WORLD.ceilingY + 3 - (yb + BAND_HEIGHT));
        for (let k = 0; k * BLOCK_HEIGHT < reach; k++) putRock('slabBlock', x, yb + BAND_HEIGHT + BLOCK_HEIGHT * (k + 0.5), o.w, 1, o.d);
      } else {
        // a ledge: the band at the gap face (bevelled ends), then stacked blocks down into the floor
        const yt = o.y + o.h / 2;
        putRock('ledgeBand', x, yt, o.w, 1, o.d);
        const reach = Math.min(o.h - BAND_HEIGHT, yt - BAND_HEIGHT - (WORLD.groundY - 0.3));
        for (let k = 0; k * BLOCK_HEIGHT < reach; k++) putRock('slabBlock', x, yt - BAND_HEIGHT - BLOCK_HEIGHT * (k + 0.5), o.w, 1, o.d);
      }
    };

    for (const o of sim.obstacles.active) {
      const x = o.x - dist;
      if (x < -20 - o.extent || x > 60) continue;
      if (o.look) {
        drawRock(o, x);
        continue;
      }
      // The look follows the obstacle's own position: the original shapes in the zone's own colours ('tinted-...'), or the original look.
      // In the Celestial Realm (2000 to 3000 m) the original shapes are drawn in the realm's own colours ('tinted').
      let style = obstacleStyleAt(o.x) ?? 'default';
      if (TINTED_ZONES[style]) style = `tinted-${style}`;
      if (!refs.current[style]) style = 'default';
      const set = refs.current[style];
      const zoned = style !== 'default' && !style.startsWith('tinted-'); // zone looks with their own shapes (animals, plants, pillars)
      const L = zoned ? styles[style].layout : null;

      if (o.kind === 'rock') {
        const i = next(style, 'rock');
        if (i >= MAX.rock) continue;
        dummy.position.set(x, o.y, o.z);
        if (zoned) {
          // a creature: kept at least as large as the collider whatever the rock's random squash, and (for flyers) facing us
          const bob = L.rockSpin ? 0 : Math.sin(t * 2 + o.rot) * 0.06;
          dummy.position.y += bob;
          if (L.rockSpin) dummy.rotation.set(o.rot + t * o.spin, o.rot * 1.3 + t * o.spin * 0.7, o.rot * 0.5);
          else dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(o.r * 1.05);
        } else {
          dummy.rotation.set(o.rot + t * o.spin, o.rot * 1.3 + t * o.spin * 0.7, o.rot * 0.5);
          dummy.scale.set(o.r * o.sx, o.r * o.sy, o.r * o.sz);
        }
        dummy.updateMatrix();
        set.rock.setMatrixAt(i, dummy.matrix);
        if (set.rim) {
          // the outline shell: the same transform, 12% larger
          dummy.scale.multiplyScalar(1.12);
          dummy.updateMatrix();
          set.rim.setMatrixAt(next(style, 'rim'), dummy.matrix);
        }
        continue;
      }

      const isColumn = o.kind === 'column';
      const bodyPart = isColumn ? 'column' : 'block';
      const bi = next(style, bodyPart);
      if (bi >= (isColumn ? MAX.column : MAX.block)) continue;
      dummy.position.set(x, o.y, 0);
      dummy.rotation.set(0, o.rot, 0);
      dummy.scale.set(o.w, o.h, o.d);
      dummy.updateMatrix();
      set[bodyPart].setMatrixAt(bi, dummy.matrix);

      if (!o.cap) continue;
      const capY = o.y + (o.cap * o.h) / 2; // the end that faces the gap

      if (isColumn) {
        if (!zoned) {
          const ci = next(style, 'cap');
          if (ci < MAX.column) {
            dummy.position.set(x, capY, 0);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(o.w * 1.04, CAP_THICKNESS, o.d * 1.04);
            dummy.updateMatrix();
            set.cap.setMatrixAt(ci, dummy.matrix);
          }
          continue;
        }
        // a plant or animal on the end of the trunk, facing the bird (animals face -x)
        const rising = o.cap > 0;
        const part = rising ? 'capUp' : 'capDown';
        const ci = next(style, part);
        if (ci < MAX.column) {
          const k = o.w * (rising ? L.capUpScale : L.capDownScale);
          dummy.position.set(x, capY, 0);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(k, k, k);
          dummy.updateMatrix();
          set[part].setMatrixAt(ci, dummy.matrix);
        }
        // growths spilling out of the trunk all along the pole, so it is a living tree and not a plain bar
        const reach = Math.min(o.h - 0.6, DECO_REACH);
        const nDeco = styles[style].geo.deco.length;
        for (let k = 0, along = 0.75; along < reach; k++, along += L.decoSpacing) {
          const yy = capY - o.cap * along;
          if (rising ? yy < WORLD.groundY - 0.3 : yy > 9) break;
          // one growth on a side that alternates, and a second on the other side every other step: the pole is wrapped
          const first = hash(o.x * 5.1) > 0.5 ? 1 : -1;
          for (let j = 0; j < (k % 2 === 0 ? 2 : 1); j++) {
            const side = (k + j) % 2 === 0 ? first : -first;
            const variant = (k + j * 2 + Math.floor(o.x * 2.3)) % nDeco;
            const di = next(style, `deco${variant}`);
            if (di >= MAX.deco) continue;
            const yj = yy + (j ? -o.cap * 0.45 : 0);
            dummy.position.set(x + side * o.w * 0.38, yj, (hash(o.x + k * 2.9 + j) - 0.3) * 0.55);
            dummy.rotation.set(0, side > 0 ? 0 : Math.PI, 0);
            dummy.scale.setScalar(o.w * 1.05);
            dummy.updateMatrix();
            set[`deco${variant}`].setMatrixAt(di, dummy.matrix);
          }
        }
        if (rising && set.base) {
          // roots flaring at the water / ground line
          const bi2 = next(style, 'base');
          if (bi2 < MAX.column) {
            dummy.position.set(x, WORLD.groundY, 0);
            dummy.rotation.set(0, o.rot, 0);
            dummy.scale.setScalar(o.w * L.baseScale);
            dummy.updateMatrix();
            set.base.setMatrixAt(bi2, dummy.matrix);
          }
        }
        continue;
      }

      // slab: a thin edge strip along the gap-facing side, plus animals on top of a lower slab / under an upper one
      const ei = next(style, 'blockCap');
      if (ei < MAX.block) {
        dummy.position.set(x, capY, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(o.w * 1.04, CAP_THICKNESS * (zoned ? 1.5 : 1), o.d * 1.04);
        dummy.updateMatrix();
        set.blockCap.setMatrixAt(ei, dummy.matrix);
      }
      if (!zoned) continue;
      if (o.cap > 0) {
        // one animal (two on a long slab), each of the two kinds in turn, standing on the slab's top edge
        const count = o.w >= 9 ? 2 : 1;
        for (let a = 0; a < count; a++) {
          const variant = Math.floor(hash(o.x * 3.1 + a * 7.7) * 2) % 2;
          const part = `up${variant}`;
          const ai = next(style, part);
          if (ai >= MAX.up) continue;
          const { len, center } = styles[style].geo.up[variant];
          const room = Math.max(0, o.w - len);
          const cx = count === 1 ? (hash(o.x) - 0.5) * room : (a === 0 ? -1 : 1) * Math.min(o.w / 4, room / 2);
          dummy.position.set(x + cx - center, capY, 0);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          set[part].setMatrixAt(ai, dummy.matrix);
        }
      } else {
        // creatures hanging from the slab's underside, spaced along it
        const count = Math.max(1, Math.min(5, Math.floor(o.w / L.downSpacing)));
        for (let a = 0; a < count; a++) {
          const di = next(style, 'down');
          if (di >= MAX.down) continue;
          const cx = (a - (count - 1) / 2) * (o.w / count) + (hash(o.x + a * 3.3) - 0.5) * 0.5;
          dummy.position.set(x + cx, capY, 0);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          set.down.setMatrixAt(di, dummy.matrix);
        }
      }
    }

    for (const [style, parts] of Object.entries(refs.current)) {
      for (const [part, mesh] of Object.entries(parts)) {
        if (!mesh) continue;
        const count = n[`${style}.${part}`] ?? 0;
        mesh.count = count;
        mesh.visible = count > 0;
        if (count > 0) mesh.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      {/* Original look: coloured by the theme */}
      <instancedMesh ref={reg('default', 'column')} args={[undefined, undefined, MAX.column]} frustumCulled={false}>
        <cylinderGeometry args={[0.5, 0.5, 1, 6]} />
        <meshStandardMaterial color={scene.column.color} emissive={scene.column.emissive} emissiveIntensity={0.6} roughness={0.85} flatShading />
      </instancedMesh>
      <instancedMesh ref={reg('default', 'cap')} args={[undefined, undefined, MAX.column]} frustumCulled={false}>
        <cylinderGeometry args={[0.5, 0.5, 1, 6]} />
        <meshBasicMaterial color={scene.column.cap} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={reg('default', 'block')} args={[undefined, undefined, MAX.block]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={scene.block.color} emissive={scene.block.emissive} emissiveIntensity={0.55} roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={reg('default', 'blockCap')} args={[undefined, undefined, MAX.block]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={scene.block.cap} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={reg('default', 'rock')} args={[undefined, undefined, MAX.rock]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={scene.rock.color} emissive={scene.rock.emissive} emissiveIntensity={0.55} roughness={0.8} flatShading />
      </instancedMesh>

      {/* The Red Rock Canyon (before 1500 m): hoodoos, fins, arches, ledges and boulders */}
      <RockSet reg={reg} geo={rocks} />

      {/* Recoloured zones (Celestial Realm, Rose Sky Palace): the same shapes in the zone's own colours */}
      {Object.entries(TINTED_ZONES).map(([id, Z]) => (
        <TintedSet key={id} id={`tinted-${id}`} reg={reg} Z={Z} />
      ))}

      {/* Zone looks: animals and plants of the Sundarbans and the Amazon (vertex-coloured geometry from obstacleStyles.js) */}
      {ACTIVE_OBSTACLE_LOOKS.map((id) => {
        const { geo } = styles[id];
        if (id === 'rock') {
          // Rock pillars (500 to 1000 m): grey-scale geometry tinted by the theme; shards glow in the theme's cap colour.
          const stone = <meshStandardMaterial vertexColors color={scene.column.color} emissive={scene.column.emissive} emissiveIntensity={0.6} roughness={0.9} flatShading />;
          const scree = <meshStandardMaterial vertexColors color={scene.rock.color} emissive={scene.rock.emissive} emissiveIntensity={0.55} roughness={0.9} flatShading />;
          const glow = <meshBasicMaterial vertexColors color={scene.column.cap} toneMapped={false} />;
          return (
            <group key={id}>
              <instancedMesh ref={reg(id, 'column')} args={[geo.column, undefined, MAX.column]} frustumCulled={false}>{stone}</instancedMesh>
              <instancedMesh ref={reg(id, 'base')} args={[geo.base, undefined, MAX.column]} frustumCulled={false}>{scree}</instancedMesh>
              <instancedMesh ref={reg(id, 'capUp')} args={[geo.capUp, undefined, MAX.column]} frustumCulled={false}>{glow}</instancedMesh>
              <instancedMesh ref={reg(id, 'capDown')} args={[geo.capDown, undefined, MAX.column]} frustumCulled={false}>{glow}</instancedMesh>
              {geo.deco.map((g, i) => (
                <instancedMesh key={i} ref={reg(id, `deco${i}`)} args={[g, undefined, MAX.deco]} frustumCulled={false}>{stone}</instancedMesh>
              ))}
            </group>
          );
        }
        const lit = <meshStandardMaterial vertexColors emissive="#2a1c10" emissiveIntensity={0.45} roughness={0.85} flatShading side={DoubleSide} />;
        return (
          <group key={id}>
            <instancedMesh ref={reg(id, 'column')} args={[geo.column, undefined, MAX.column]} frustumCulled={false}>{lit}</instancedMesh>
            <instancedMesh ref={reg(id, 'base')} args={[geo.base, undefined, MAX.column]} frustumCulled={false}>{lit}</instancedMesh>
            <instancedMesh ref={reg(id, 'capUp')} args={[geo.capUp, undefined, MAX.column]} frustumCulled={false}>{lit}</instancedMesh>
            <instancedMesh ref={reg(id, 'capDown')} args={[geo.capDown, undefined, MAX.column]} frustumCulled={false}>{lit}</instancedMesh>
            <instancedMesh ref={reg(id, 'block')} args={[geo.block, undefined, MAX.block]} frustumCulled={false}>{lit}</instancedMesh>
            <instancedMesh ref={reg(id, 'blockCap')} args={[geo.blockCap, undefined, MAX.block]} frustumCulled={false}>
              <meshBasicMaterial vertexColors toneMapped={false} />
            </instancedMesh>
            {geo.up.map((u, i) => (
              <instancedMesh key={i} ref={reg(id, `up${i}`)} args={[u.geometry, undefined, MAX.up]} frustumCulled={false}>{lit}</instancedMesh>
            ))}
            {geo.deco.map((g, i) => (
              <instancedMesh key={i} ref={reg(id, `deco${i}`)} args={[g, undefined, MAX.deco]} frustumCulled={false}>{lit}</instancedMesh>
            ))}
            <instancedMesh ref={reg(id, 'down')} args={[geo.down, undefined, MAX.down]} frustumCulled={false}>{lit}</instancedMesh>
            <instancedMesh ref={reg(id, 'rock')} args={[geo.rock, undefined, MAX.rock]} frustumCulled={false}>{lit}</instancedMesh>
          </group>
        );
      })}
    </group>
  );
}

/** The six original obstacle meshes in one zone's colours: dark bodies with bright caps, and a glowing outline round floating rocks. */
function TintedSet({ id, reg, Z }) {
  return (
    <group>
      <instancedMesh ref={reg(id, 'column')} args={[undefined, undefined, MAX.column]} frustumCulled={false}>
        <cylinderGeometry args={[0.5, 0.5, 1, 6]} />
        <meshStandardMaterial color={Z.column.color} emissive={Z.column.emissive} emissiveIntensity={0.7} roughness={0.7} flatShading />
      </instancedMesh>
      <instancedMesh ref={reg(id, 'cap')} args={[undefined, undefined, MAX.column]} frustumCulled={false}>
        <cylinderGeometry args={[0.5, 0.5, 1, 6]} />
        <meshBasicMaterial color={Z.column.cap} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={reg(id, 'block')} args={[undefined, undefined, MAX.block]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={Z.block.color} emissive={Z.block.emissive} emissiveIntensity={0.7} roughness={0.7} flatShading />
      </instancedMesh>
      <instancedMesh ref={reg(id, 'blockCap')} args={[undefined, undefined, MAX.block]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={Z.block.cap} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={reg(id, 'rock')} args={[undefined, undefined, MAX.rock]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={Z.rock.color} emissive={Z.rock.emissive} emissiveIntensity={0.9} roughness={0.5} metalness={0.2} flatShading />
      </instancedMesh>
      <instancedMesh ref={reg(id, 'rim')} args={[undefined, undefined, MAX.rock]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={Z.rock.rim} side={BackSide} transparent opacity={0.9} toneMapped={false} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

/** One instanced mesh per canyon rock piece, all sharing one sandstone material (vertex colours carry the strata). */
function RockSet({ reg, geo }) {
  return (
    <group>
      {Object.entries(ROCK_MAX).map(([key, max]) => (
        <instancedMesh key={key} ref={reg('rocks', key)} args={[geo[key], undefined, max]} frustumCulled={false}>
          <meshStandardMaterial vertexColors flatShading roughness={0.9} emissive="#4a1a0c" emissiveIntensity={0.55} />
        </instancedMesh>
      ))}
    </group>
  );
}
