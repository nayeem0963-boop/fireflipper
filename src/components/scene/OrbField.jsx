import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Object3D } from 'three';

/**
 * Fire orbs: a bright core and an additive halo, each a single
 * InstancedMesh (2 draw calls total). Orbs bob and pulse gently.
 */
const MAX_ORBS = 64;

export default function OrbField({ sim }) {
  const cores = useRef();
  const halos = useRef();
  const dummy = useMemo(() => new Object3D(), []);

  useFrame(() => {
    if (!cores.current) return;
    const dist = sim.renderDistance();
    const t = sim.time;
    let n = 0;
    for (const orb of sim.orbs.active) {
      const x = orb.x - dist;
      if (x < -15 || x > 60 || n >= MAX_ORBS) continue;
      const y = orb.y + Math.sin(t * 2.6 + orb.phase) * 0.12;
      const pulse = 1 + Math.sin(t * 6 + orb.phase) * 0.12;

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
    cores.current.instanceMatrix.needsUpdate = true;
    halos.current.instanceMatrix.needsUpdate = true;
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
    </group>
  );
}
