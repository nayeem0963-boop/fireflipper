import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, Object3D } from 'three';

/**
 * Renders every pooled obstacle with a handful of InstancedMeshes, so
 * the whole obstacle field costs ~5 draw calls no matter how many
 * obstacles are alive. Instance matrices are rewritten each frame from
 * simulation data; nothing is allocated per frame.
 *
 * Geometry and materials are declared in JSX, so R3F disposes them when
 * the scene unmounts.
 */
const MAX = { column: 48, block: 12, rock: 112, geyser: 12 };

// Geyser colours (additive, so black is invisible): a dim ember while charging, a hot orange plume when
// erupting, with a brighter narrow core inside.
const GEYSER_COOL = new Color('#3a1204');
const GEYSER_HOT = new Color('#ff7a1a');
const CORE_COOL = new Color('#000000');
const CORE_HOT = new Color('#ffe9b0');
const CAP_THICKNESS = 0.14;

export default function ObstacleField({ sim }) {
  const columns = useRef();
  const columnCaps = useRef();
  const blocks = useRef();
  const blockCaps = useRef();
  const rocks = useRef();
  const geysers = useRef();
  const cores = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const tint = useMemo(() => new Color(), []);

  // Instance colours must exist before the first frame.
  useEffect(() => {
    for (let i = 0; i < MAX.geyser; i++) {
      geysers.current?.setColorAt(i, GEYSER_COOL);
      cores.current?.setColorAt(i, CORE_COOL);
    }
  }, []);

  useFrame(() => {
    if (!columns.current) return;
    const dist = sim.renderDistance();
    const t = sim.time;
    let nCol = 0;
    let nColCap = 0;
    let nBlock = 0;
    let nBlockCap = 0;
    let nRock = 0;
    let nGeyser = 0;

    for (const o of sim.obstacles.active) {
      const x = o.x - dist;
      if (x < -20 - o.extent || x > 60) continue;

      if (o.kind === 'rock') {
        if (nRock >= MAX.rock || o.fade <= 0.01) continue;
        dummy.position.set(x, o.y, o.z);
        dummy.rotation.set(o.rot + t * o.spin, o.rot * 1.3 + t * o.spin * 0.7, o.rot * 0.5);
        // A shattering rock shrinks away (fade runs 1 -> 0 after it lands).
        dummy.scale.set(o.r * o.sx * o.fade, o.r * o.sy * o.fade, o.r * o.sz * o.fade);
        dummy.updateMatrix();
        rocks.current.setMatrixAt(nRock++, dummy.matrix);
        continue;
      }

      if (o.kind === 'geyser') {
        if (nGeyser >= MAX.geyser) continue;
        dummy.position.set(x, o.y, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(o.w * 0.85, o.h, o.d * 0.85);
        dummy.updateMatrix();
        geysers.current.setMatrixAt(nGeyser, dummy.matrix);
        tint.copy(GEYSER_COOL).lerp(GEYSER_HOT, o.glow);
        geysers.current.setColorAt(nGeyser, tint);
        dummy.scale.set(o.w * 0.36, o.h, o.d * 0.36);
        dummy.updateMatrix();
        cores.current.setMatrixAt(nGeyser, dummy.matrix);
        // The core only lights up during the eruption itself.
        tint.copy(CORE_COOL).lerp(CORE_HOT, Math.max(0, (o.glow - 0.5) * 2));
        cores.current.setColorAt(nGeyser, tint);
        nGeyser++;
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
    commit(geysers.current, nGeyser);
    commit(cores.current, nGeyser);
    if (geysers.current.instanceColor) geysers.current.instanceColor.needsUpdate = true;
    if (cores.current.instanceColor) cores.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={columns} args={[undefined, undefined, MAX.column]} frustumCulled={false}>
        <cylinderGeometry args={[0.5, 0.5, 1, 6]} />
        <meshStandardMaterial
          color="#6b4433"
          emissive="#3a1004"
          emissiveIntensity={0.6}
          roughness={0.85}
          flatShading
        />
      </instancedMesh>
      <instancedMesh ref={columnCaps} args={[undefined, undefined, MAX.column]} frustumCulled={false}>
        <cylinderGeometry args={[0.5, 0.5, 1, 6]} />
        <meshBasicMaterial color="#ff8a2a" toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={blocks} args={[undefined, undefined, MAX.block]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#5e3b2c"
          emissive="#3a1004"
          emissiveIntensity={0.55}
          roughness={0.9}
          flatShading
        />
      </instancedMesh>
      <instancedMesh ref={blockCaps} args={[undefined, undefined, MAX.block]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#ff7a1f" toneMapped={false} />
      </instancedMesh>

      <instancedMesh
        ref={geysers}
        args={[undefined, undefined, MAX.geyser]}
        frustumCulled={false}
        renderOrder={2}
      >
        <cylinderGeometry args={[0.5, 0.62, 1, 10]} />
        <meshBasicMaterial
          toneMapped={false}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </instancedMesh>
      <instancedMesh
        ref={cores}
        args={[undefined, undefined, MAX.geyser]}
        frustumCulled={false}
        renderOrder={3}
      >
        <cylinderGeometry args={[0.5, 0.6, 1, 10]} />
        <meshBasicMaterial toneMapped={false} transparent depthWrite={false} blending={AdditiveBlending} />
      </instancedMesh>

      <instancedMesh ref={rocks} args={[undefined, undefined, MAX.rock]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color="#7a4b36"
          emissive="#4a1405"
          emissiveIntensity={0.55}
          roughness={0.8}
          flatShading
        />
      </instancedMesh>
    </group>
  );
}

function commit(mesh, count) {
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
}
