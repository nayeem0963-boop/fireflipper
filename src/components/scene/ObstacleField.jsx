import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Object3D } from 'three';
import { RENDER_CAPS } from '../../systems/obstacles/renderCaps.js';
import { envState, environmentAt } from '../../systems/world/environments.js';

/**
 * Renders every pooled obstacle with a handful of InstancedMeshes, so
 * the whole obstacle field costs ~5 draw calls no matter how many
 * obstacles are alive. Instance matrices are rewritten each frame from
 * simulation data; nothing is allocated per frame.
 *
 * Geometry and materials are declared in JSX, so R3F disposes them when
 * the scene unmounts.
 */
const MAX = RENDER_CAPS; // shared with the tests: the generator must never exceed these
const CAP_THICKNESS = 0.14;
const HAZARD_KINDS = new Set(['boulder', 'geyser', 'spinner', 'ring']);

export default function ObstacleField({ sim }) {
  const columns = useRef();
  const columnCaps = useRef();
  const blocks = useRef();
  const blockCaps = useRef();
  const rocks = useRef();
  const mats = { column: useRef(), block: useRef(), rock: useRef(), columnCap: useRef(), blockCap: useRef() };
  const dummy = useMemo(() => new Object3D(), []);

  useFrame((state) => {
    if (!columns.current) return;
    const dist = sim.renderDistance();

    // Tint for the current environment (blended, so it never jumps). The glowing caps are the
    // readable edge of every gap, so they are drawn without fog and stay visible even in the storm.
    const e = environmentAt(dist, envState);
    const o = e.obstacle;
    const t0 = state.clock.elapsedTime;
    const flick = 1 + e.effects.flicker * (0.16 * Math.sin(t0 * 10) + 0.08 * Math.sin(t0 * 23.1));
    const tint = (ref, k, em = 1) => {
      ref.current.color.setRGB(o.color[0] * k, o.color[1] * k, o.color[2] * k);
      ref.current.emissive.setRGB(o.emissive[0], o.emissive[1], o.emissive[2]);
      ref.current.emissiveIntensity = o.emissiveIntensity * flick * em;
    };
    tint(mats.column, 1);
    tint(mats.block, 0.88, 0.92);
    tint(mats.rock, 1.1, 1.0);
    mats.columnCap.current.color.setRGB(o.cap[0], o.cap[1], o.cap[2]);
    mats.blockCap.current.color.setRGB(o.cap[0] * 0.93, o.cap[1] * 0.9, o.cap[2] * 0.85);

    const t = sim.time;
    let nCol = 0;
    let nColCap = 0;
    let nBlock = 0;
    let nBlockCap = 0;
    let nRock = 0;

    for (const o of sim.obstacles.active) {
      const x = o.x - dist;
      if (x < -20 - o.extent || x > 60) continue;
      if (HAZARD_KINDS.has(o.kind)) continue; // drawn by HazardField

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
        <meshStandardMaterial ref={mats.column} color="#6b4433" emissive="#3a1004" emissiveIntensity={0.6} roughness={0.85} flatShading />
      </instancedMesh>
      <instancedMesh ref={columnCaps} args={[undefined, undefined, MAX.column]} frustumCulled={false}>
        <cylinderGeometry args={[0.5, 0.5, 1, 6]} />
        <meshBasicMaterial ref={mats.columnCap} color="#ff8a2a" fog={false} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={blocks} args={[undefined, undefined, MAX.block]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial ref={mats.block} color="#5e3b2c" emissive="#3a1004" emissiveIntensity={0.55} roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={blockCaps} args={[undefined, undefined, MAX.block]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial ref={mats.blockCap} color="#ff7a1f" fog={false} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={rocks} args={[undefined, undefined, MAX.rock]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial ref={mats.rock} color="#7a4b36" emissive="#4a1405" emissiveIntensity={0.55} roughness={0.8} flatShading />
      </instancedMesh>
    </group>
  );
}

function commit(mesh, count) {
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
}
