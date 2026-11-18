import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, Object3D } from 'three';
import { WORLD } from '../../systems/physics/constants.js';
import { biomeAt } from '../../systems/world/biomes.js';
import { useTheme } from '../../hooks/useTheme.js';
import { OBSTACLE_STYLE_IDS, createObstacleStyle, styleGeometries } from './obstacleStyles.js';

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
 * Each obstacle is drawn in the look of the scenery zone it stands in (chosen by its own track position):
 * the original look (coloured by the theme), or the Sundarbans / Amazon look with the animals and plants of those regions
 * (tigers, crocodiles, bats, beehives, toucans, jaguars, sloths, morpho butterflies...; see obstacleStyles.js). Only the
 * drawing differs: colliders never change.
 * Meshes with nothing to draw are hidden, so a look costs nothing when it is not on screen.
 */
const MAX = { column: 48, block: 12, rock: 112, up: 16, down: 48 };
const CAP_THICKNESS = 0.14;
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
  const styles = useMemo(() => Object.fromEntries(OBSTACLE_STYLE_IDS.map((id) => [id, createObstacleStyle(id)])), []);
  useEffect(() => () => Object.values(styles).forEach((st) => styleGeometries(st).forEach((g) => g.dispose())), [styles]);

  useFrame(() => {
    const def = refs.current.default;
    if (!def?.column) return;
    const dist = sim.renderDistance();
    const t = sim.time;
    // per (style, part) write index
    const n = {};
    const next = (style, part) => (n[`${style}.${part}`] = (n[`${style}.${part}`] ?? 0) + 1) - 1;

    for (const o of sim.obstacles.active) {
      const x = o.x - dist;
      if (x < -20 - o.extent || x > 60) continue;
      const zone = biomeAt(o.x);
      const style = zone && refs.current[zone.id] ? zone.id : 'default';
      const set = refs.current[style];
      const zoned = style !== 'default';
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

      {/* Zone looks: animals and plants of the Sundarbans and the Amazon (vertex-coloured geometry from obstacleStyles.js) */}
      {OBSTACLE_STYLE_IDS.map((id) => {
        const { geo } = styles[id];
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
            <instancedMesh ref={reg(id, 'down')} args={[geo.down, undefined, MAX.down]} frustumCulled={false}>{lit}</instancedMesh>
            <instancedMesh ref={reg(id, 'rock')} args={[geo.rock, undefined, MAX.rock]} frustumCulled={false}>{lit}</instancedMesh>
          </group>
        );
      })}
    </group>
  );
}
