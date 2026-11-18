import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, NormalBlending, Object3D } from 'three';
import { biomeWeights } from '../../systems/world/biomes.js';
import { useTheme } from '../../hooks/useTheme.js';

/**
 * Fire orbs: a bright core and an additive halo, each a single
 * InstancedMesh (2 draw calls total). Orbs bob and pulse gently.
 */
const MAX_ORBS = 64;

export default function OrbField({ sim }) {
  const { scene } = useTheme();
  const cores = useRef();
  const halos = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const coreMat = useRef();
  const haloMat = useRef();
  const day = useRef(null);
  const colors = useMemo(() => ({ coreNight: new Color(scene.orbCore), haloNight: new Color(scene.orbHalo), coreDay: new Color('#ffb21a'), haloDay: new Color('#ff6a10') }), [scene]);
  useEffect(() => {
    day.current = null; // re-apply after a theme change
  }, [colors]);

  useFrame(() => {
    if (!cores.current) return;
    const dist = sim.renderDistance();
    // In the bright Sundarbans daylight an additive glow washes out on the pale sky and water, so the orbs switch to
    // a saturated, normally blended halo there (still the same orb, same size and hitbox: looks only).
    const isDay = biomeWeights(dist).sundarbans > 0.5; // the Amazon is dark enough for the additive glow
    if (isDay !== day.current && coreMat.current && haloMat.current) {
      day.current = isDay;
      coreMat.current.color.copy(isDay ? colors.coreDay : colors.coreNight);
      haloMat.current.color.copy(isDay ? colors.haloDay : colors.haloNight);
      haloMat.current.blending = isDay ? NormalBlending : AdditiveBlending;
      haloMat.current.opacity = isDay ? 0.6 : 0.35;
      haloMat.current.needsUpdate = true;
    }
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
        <meshBasicMaterial ref={coreMat} color={scene.orbCore} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={halos} args={[undefined, undefined, MAX_ORBS]} frustumCulled={false} renderOrder={2}>
        <icosahedronGeometry args={[0.46, 2]} />
        <meshBasicMaterial ref={haloMat} color={scene.orbHalo} transparent opacity={0.35} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
