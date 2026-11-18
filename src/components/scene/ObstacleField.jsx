import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Object3D } from 'three';
import { BIOMES, biomeWeights } from '../../systems/world/biomes.js';
import { useTheme } from '../../hooks/useTheme.js';

/**
 * Renders every pooled obstacle with a handful of InstancedMeshes, so
 * the whole obstacle field costs ~5 draw calls no matter how many
 * obstacles are alive. Instance matrices are rewritten each frame from
 * simulation data; nothing is allocated per frame.
 *
 * Geometry and materials are declared in JSX, so R3F disposes them when
 * the scene unmounts.
 */
const MAX = { column: 48, block: 12, rock: 112 };
const CAP_THICKNESS = 0.14;

export default function ObstacleField({ sim }) {
  const { scene } = useTheme();
  const columns = useRef();
  const columnCaps = useRef();
  const blocks = useRef();
  const blockCaps = useRef();
  const rocks = useRef();
  const dummy = useMemo(() => new Object3D(), []);

  // Obstacle colours blend from the theme's to each zone's tones (Sundarbans bark / planks, Amazon sunlit wood). They stay
  // bright against the backdrop so they read at a glance. Visual only: the colliders never change.
  const mats = useRef({});
  const lastKey = useRef(-1);
  const pairs = useMemo(() => {
    const S = BIOMES.sundarbans.scene;
    const A = BIOMES.amazon.scene;
    const trio = (a, b, c) => [new Color(a), new Color(b), new Color(c)];
    return {
      column: trio(scene.column.color, S.column.color, A.column.color), columnE: trio(scene.column.emissive, S.column.emissive, A.column.emissive),
      columnCap: trio(scene.column.cap, S.column.cap, A.column.cap),
      block: trio(scene.block.color, S.block.color, A.block.color), blockE: trio(scene.block.emissive, S.block.emissive, A.block.emissive),
      blockCap: trio(scene.block.cap, S.block.cap, A.block.cap),
      rock: trio(scene.rock.color, S.rock.color, A.rock.color), rockE: trio(scene.rock.emissive, S.rock.emissive, A.rock.emissive),
    };
  }, [scene]);
  useEffect(() => {
    lastKey.current = -1; // re-apply after a theme change
  }, [pairs]);

  useFrame(() => {
    if (!columns.current) return;
    const dist = sim.renderDistance();
    const w = biomeWeights(dist);
    const k = w.sundarbans * 1000 + w.amazon * 1000 + (w.amazon > 0 ? 5000 : 0);
    if (Math.abs(k - lastKey.current) > 2 || lastKey.current === -1) {
      lastKey.current = k;
      const m = mats.current;
      const set = (mat, key, emissiveKey) => {
        if (!mat) return;
        const [base, sund, amaz] = pairs[key];
        mat.color.copy(base).lerp(sund, w.sundarbans).lerp(amaz, w.amazon);
        if (emissiveKey) {
          const [eb, es, ea] = pairs[emissiveKey];
          mat.emissive.copy(eb).lerp(es, w.sundarbans).lerp(ea, w.amazon);
        }
      };
      set(m.column, 'column', 'columnE');
      set(m.columnCap, 'columnCap');
      set(m.block, 'block', 'blockE');
      set(m.blockCap, 'blockCap');
      set(m.rock, 'rock', 'rockE');
    }
    const t = sim.time;
    let nCol = 0;
    let nColCap = 0;
    let nBlock = 0;
    let nBlockCap = 0;
    let nRock = 0;

    for (const o of sim.obstacles.active) {
      const x = o.x - dist;
      if (x < -20 - o.extent || x > 60) continue;

      if (o.kind === 'rock') {
        if (nRock >= MAX.rock) continue;
        dummy.position.set(x, o.y, o.z);
        dummy.rotation.set(o.rot + t * o.spin, o.rot * 1.3 + t * o.spin * 0.7, o.rot * 0.5);
        dummy.scale.set(o.r * o.sx, o.r * o.sy, o.r * o.sz);
        dummy.updateMatrix();
        rocks.current.setMatrixAt(nRock++, dummy.matrix);
        continue;
      }

      const isColumn = o.kind === 'column';
      const mesh = isColumn ? columns.current : blocks.current;
      if (isColumn ? nCol >= MAX.column : nBlock >= MAX.block) continue;
      dummy.position.set(x, o.y, 0);
      dummy.rotation.set(0, o.rot, 0);
      dummy.scale.set(o.w, o.h, o.d);
      dummy.updateMatrix();
      mesh.setMatrixAt(isColumn ? nCol++ : nBlock++, dummy.matrix);

      // Glowing cap on the end facing the gap: makes the corridor edge readable.
      if (o.cap) {
        const capY = o.y + (o.cap * o.h) / 2;
        dummy.position.set(x, capY, 0);
        dummy.scale.set(o.w * 1.04, CAP_THICKNESS, o.d * 1.04);
        dummy.updateMatrix();
        if (isColumn) columnCaps.current.setMatrixAt(nColCap++, dummy.matrix);
        else blockCaps.current.setMatrixAt(nBlockCap++, dummy.matrix);
      }
    }

    commit(columns.current, nCol);
    commit(columnCaps.current, nColCap);
    commit(blocks.current, nBlock);
    commit(blockCaps.current, nBlockCap);
    commit(rocks.current, nRock);
  });

  return (
    <group>
      <instancedMesh ref={columns} args={[undefined, undefined, MAX.column]} frustumCulled={false}>
        <cylinderGeometry args={[0.5, 0.5, 1, 6]} />
        <meshStandardMaterial ref={(m) => (mats.current.column = m)} color={scene.column.color} emissive={scene.column.emissive} emissiveIntensity={0.6} roughness={0.85} flatShading />
      </instancedMesh>
      <instancedMesh ref={columnCaps} args={[undefined, undefined, MAX.column]} frustumCulled={false}>
        <cylinderGeometry args={[0.5, 0.5, 1, 6]} />
        <meshBasicMaterial ref={(m) => (mats.current.columnCap = m)} color={scene.column.cap} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={blocks} args={[undefined, undefined, MAX.block]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial ref={(m) => (mats.current.block = m)} color={scene.block.color} emissive={scene.block.emissive} emissiveIntensity={0.55} roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={blockCaps} args={[undefined, undefined, MAX.block]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial ref={(m) => (mats.current.blockCap = m)} color={scene.block.cap} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={rocks} args={[undefined, undefined, MAX.rock]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial ref={(m) => (mats.current.rock = m)} color={scene.rock.color} emissive={scene.rock.emissive} emissiveIntensity={0.55} roughness={0.8} flatShading />
      </instancedMesh>
    </group>
  );
}

function commit(mesh, count) {
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
}
