import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Object3D } from 'three';
import { RENDER_CAPS } from '../../systems/obstacles/renderCaps.js';

/**
 * Pickups. Fire orbs are a bright core with an additive halo (warm gold);
 * gems are spinning cyan crystals with a cool halo, so the rare, valuable
 * pickup is unmistakable from across the screen. Each is one InstancedMesh
 * (4 draw calls in all). Both bob and pulse gently.
 */
const MAX_ORBS = RENDER_CAPS.orb;
const MAX_GEMS = RENDER_CAPS.gem;

export default function OrbField({ sim }) {
  const cores = useRef();
  const halos = useRef();
  const gemCores = useRef();
  const gemHalos = useRef();
  const dummy = useMemo(() => new Object3D(), []);

  useFrame(() => {
    if (!cores.current) return;
    const dist = sim.renderDistance();
    const t = sim.time;
    let n = 0;
    let g = 0;
    for (const orb of sim.orbs.active) {
      const x = orb.x - dist;
      if (x < -15 || x > 60) continue;
      const y = orb.y + Math.sin(t * 2.6 + orb.phase) * 0.12;
      const pulse = 1 + Math.sin(t * 6 + orb.phase) * 0.12;

      if (orb.kind === 1) {
        if (g >= MAX_GEMS) continue;
        dummy.position.set(x, y, 0);
        dummy.rotation.set(0, t * 1.8 + orb.phase, 0);
        dummy.scale.setScalar(pulse);
        dummy.updateMatrix();
        gemCores.current.setMatrixAt(g, dummy.matrix);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(pulse * 1.2);
        dummy.updateMatrix();
        gemHalos.current.setMatrixAt(g, dummy.matrix);
        g++;
        continue;
      }
      if (n >= MAX_ORBS) continue;
      dummy.position.set(x, y, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(pulse);
      dummy.updateMatrix();
      cores.current.setMatrixAt(n, dummy.matrix);
      dummy.scale.setScalar(pulse * 1.15);
      dummy.updateMatrix();
      halos.current.setMatrixAt(n, dummy.matrix);
      n++;
    }
    cores.current.count = halos.current.count = n;
    gemCores.current.count = gemHalos.current.count = g;
    cores.current.instanceMatrix.needsUpdate = true;
    halos.current.instanceMatrix.needsUpdate = true;
    gemCores.current.instanceMatrix.needsUpdate = true;
    gemHalos.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={cores} args={[undefined, undefined, MAX_ORBS]} frustumCulled={false}>
        <icosahedronGeometry args={[0.2, 2]} />
        <meshBasicMaterial color="#fff0b8" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={halos} args={[undefined, undefined, MAX_ORBS]} frustumCulled={false} renderOrder={2}>
        <icosahedronGeometry args={[0.46, 2]} />
        <meshBasicMaterial color="#ff8a24" transparent opacity={0.35} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={gemCores} args={[undefined, undefined, MAX_GEMS]} frustumCulled={false}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshBasicMaterial color="#8af4ff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={gemHalos} args={[undefined, undefined, MAX_GEMS]} frustumCulled={false} renderOrder={2}>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshBasicMaterial color="#38b6ff" transparent opacity={0.4} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
