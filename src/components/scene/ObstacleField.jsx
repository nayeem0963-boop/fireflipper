import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Object3D } from 'three';
import { biomeAt } from '../../systems/world/biomes.js';
import { useTheme } from '../../hooks/useTheme.js';
import { OBSTACLE_STYLE_IDS, createObstacleStyle } from './obstacleStyles.js';

/**
 * Renders every pooled obstacle with a few InstancedMeshes per look, so the whole obstacle field stays at a handful
 * of draw calls no matter how many obstacles are alive. Instance matrices are rewritten each frame from simulation
 * data; nothing is allocated per frame.
 *
 * Each obstacle is drawn in the look of the scenery zone it stands in (chosen by its own track position):
 * the original look (coloured by the theme), Sundarbans mangroves / mud banks / driftwood, or Amazon trunks /
 * fallen logs / mossy boulders (see obstacleStyles.js). Only the drawing differs: colliders never change.
 * Meshes with nothing to draw are hidden, so a look costs nothing when it is not on screen.
 */
const MAX = { column: 48, block: 12, rock: 112 };
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
  useEffect(
    () => () => Object.values(styles).forEach((set) => Object.values(set).forEach((g) => g.dispose())),
    [styles],
  );

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

      if (o.kind === 'rock') {
        const i = next(style, 'rock');
        if (i >= MAX.rock) continue;
        dummy.position.set(x, o.y, o.z);
        dummy.rotation.set(o.rot + t * o.spin, o.rot * 1.3 + t * o.spin * 0.7, o.rot * 0.5);
        dummy.scale.set(o.r * o.sx, o.r * o.sy, o.r * o.sz);
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

      // Cap on the end facing the gap: makes the corridor edge readable.
      if (o.cap) {
        const capY = o.y + (o.cap * o.h) / 2;
        let part;
        if (isColumn) part = !zoned ? 'cap' : o.cap > 0 ? 'capUp' : 'capDown';
        else part = 'blockCap';
        const ci = next(style, part);
        if (ci >= (isColumn ? MAX.column : MAX.block)) continue;
        if (isColumn && zoned) {
          // a crown / root tangle about as wide as the trunk, sitting on its end
          dummy.position.set(x, capY, 0);
          dummy.rotation.set(0, o.rot, 0);
          dummy.scale.set(o.w * ZONE_CAP, o.w * ZONE_CAP, o.d * ZONE_CAP);
        } else {
          dummy.position.set(x, capY, 0);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(o.w * 1.04, CAP_THICKNESS * (zoned ? 1.5 : 1), o.d * 1.04);
        }
        dummy.updateMatrix();
        (isColumn ? set[part] : set.blockCap).setMatrixAt(ci, dummy.matrix);
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

      {/* Zone looks: Sundarbans and Amazon (vertex-coloured geometry from obstacleStyles.js) */}
      {OBSTACLE_STYLE_IDS.map((id) => {
        const g = styles[id];
        return (
          <group key={id}>
            <instancedMesh ref={reg(id, 'column')} args={[g.column, undefined, MAX.column]} frustumCulled={false}>
              <meshStandardMaterial vertexColors emissive="#2a1c10" emissiveIntensity={0.5} roughness={0.85} flatShading />
            </instancedMesh>
            <instancedMesh ref={reg(id, 'capUp')} args={[g.capUp, undefined, MAX.column]} frustumCulled={false}>
              <meshBasicMaterial vertexColors toneMapped={false} />
            </instancedMesh>
            <instancedMesh ref={reg(id, 'capDown')} args={[g.capDown, undefined, MAX.column]} frustumCulled={false}>
              <meshBasicMaterial vertexColors toneMapped={false} />
            </instancedMesh>
            <instancedMesh ref={reg(id, 'block')} args={[g.block, undefined, MAX.block]} frustumCulled={false}>
              <meshStandardMaterial vertexColors emissive="#2a1c10" emissiveIntensity={0.5} roughness={0.9} flatShading />
            </instancedMesh>
            <instancedMesh ref={reg(id, 'blockCap')} args={[g.blockCap, undefined, MAX.block]} frustumCulled={false}>
              <meshBasicMaterial vertexColors toneMapped={false} />
            </instancedMesh>
            <instancedMesh ref={reg(id, 'rock')} args={[g.rock, undefined, MAX.rock]} frustumCulled={false}>
              <meshStandardMaterial vertexColors emissive="#2a2014" emissiveIntensity={0.45} roughness={0.8} flatShading />
            </instancedMesh>
          </group>
        );
      })}
    </group>
  );
}
