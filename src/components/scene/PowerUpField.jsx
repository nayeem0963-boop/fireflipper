import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, Object3D } from 'three';
import { POWERUP_INFO } from '../../systems/powerups/appearance.js';

/**
 * Floating power-up pickups: a spinning gem plus an additive halo, each a
 * single InstancedMesh tinted per type via instance colours.
 */
const MAX = 12;

export default function PowerUpField({ sim }) {
  const gems = useRef();
  const halos = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const tint = useMemo(() => new Color(), []);

  // Make sure the instance colour buffers exist before the first frame.
  useEffect(() => {
    for (const mesh of [gems.current, halos.current]) {
      tint.set('#ffffff');
      for (let i = 0; i < MAX; i++) mesh.setColorAt(i, tint);
    }
  }, [tint]);

  useFrame(() => {
    if (!gems.current) return;
    const dist = sim.renderDistance();
    const t = sim.time;
    let n = 0;
    for (const p of sim.powerups.active) {
      const x = p.x - dist;
      if (x < -15 || x > 60 || n >= MAX) continue;
      const y = p.y + Math.sin(t * 2.2 + p.phase) * 0.15;
      const pulse = 1 + Math.sin(t * 5 + p.phase) * 0.1;

      dummy.position.set(x, y, 0);
      dummy.rotation.set(t * 1.3 + p.phase, t * 1.9, 0);
      dummy.scale.setScalar(pulse);
      dummy.updateMatrix();
      gems.current.setMatrixAt(n, dummy.matrix);

      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(pulse * 1.1);
      dummy.updateMatrix();
      halos.current.setMatrixAt(n, dummy.matrix);

      tint.set(POWERUP_INFO[p.type].color);
      gems.current.setColorAt(n, tint);
      halos.current.setColorAt(n, tint);
      n++;
    }
    gems.current.count = halos.current.count = n;
    gems.current.instanceMatrix.needsUpdate = true;
    halos.current.instanceMatrix.needsUpdate = true;
    if (gems.current.instanceColor) gems.current.instanceColor.needsUpdate = true;
    if (halos.current.instanceColor) halos.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={gems} args={[undefined, undefined, MAX]} frustumCulled={false}>
        <octahedronGeometry args={[0.32, 0]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={halos} args={[undefined, undefined, MAX]} frustumCulled={false} renderOrder={2}>
        <icosahedronGeometry args={[0.62, 2]} />
        <meshBasicMaterial
          transparent
          opacity={0.16}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}
