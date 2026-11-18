import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Object3D } from 'three';
import { RENDER_CAPS } from '../../systems/obstacles/renderCaps.js';

/**
 * Pickups. Each kind differs in colour AND shape, so none is mistaken for another
 * (including by players who can't tell the colours apart):
 *   fire orb  gold sphere with a warm halo        (score)
 *   gem       spinning cyan octahedron            (rare: score and currency)
 *   shield    green hexagonal plate, wobbling     (absorbs one hit)
 *   magnet    magenta ring turning in place       (pulls orbs in)
 * Each is an InstancedMesh core plus an additive halo (8 draw calls in all), and bobs gently.
 */
const MAX = RENDER_CAPS;

export default function OrbField({ sim }) {
  const refs = {
    orb: useRef(),
    orbHalo: useRef(),
    gem: useRef(),
    gemHalo: useRef(),
    shield: useRef(),
    shieldHalo: useRef(),
    magnet: useRef(),
    magnetHalo: useRef(),
  };
  const dummy = useMemo(() => new Object3D(), []);

  useFrame(() => {
    if (!refs.orb.current) return;
    const dist = sim.renderDistance();
    const t = sim.time;
    const n = { orb: 0, gem: 0, shield: 0, magnet: 0 };
    const place = (kind, x, y, rot, scale, haloScale) => {
      const i = n[kind]++;
      dummy.position.set(x, y, 0);
      dummy.rotation.set(rot[0], rot[1], rot[2]);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      refs[kind].current.setMatrixAt(i, dummy.matrix);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(haloScale);
      dummy.updateMatrix();
      refs[`${kind}Halo`].current.setMatrixAt(i, dummy.matrix);
    };

    for (const orb of sim.orbs.active) {
      const x = orb.x - dist;
      if (x < -15 || x > 60) continue;
      const y = orb.y + Math.sin(t * 2.6 + orb.phase) * 0.12;
      const pulse = 1 + Math.sin(t * 6 + orb.phase) * 0.12;
      const kind = orb.kind === 1 ? 'gem' : orb.kind === 2 ? 'shield' : orb.kind === 3 ? 'magnet' : 'orb';
      if (n[kind] >= MAX[kind === 'orb' ? 'orb' : kind]) continue;
      if (kind === 'gem') place('gem', x, y, [0, t * 1.8 + orb.phase, 0], pulse, pulse * 1.2);
      else if (kind === 'shield') place('shield', x, y, [Math.PI / 2, 0, Math.sin(t * 1.6 + orb.phase) * 0.5], 1 + Math.sin(t * 4 + orb.phase) * 0.06, pulse * 1.25);
      else if (kind === 'magnet') place('magnet', x, y, [0, 0, t * 2.2 + orb.phase], pulse, pulse * 1.3);
      else place('orb', x, y, [0, 0, 0], pulse, pulse * 1.15);
    }

    for (const kind of Object.keys(n)) {
      const core = refs[kind].current;
      const halo = refs[`${kind}Halo`].current;
      core.count = halo.count = n[kind];
      core.instanceMatrix.needsUpdate = true;
      halo.instanceMatrix.needsUpdate = true;
    }
  });

  const halo = (color, opacity, size) => (
    <>
      <icosahedronGeometry args={[size, 2]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} blending={AdditiveBlending} fog={false} toneMapped={false} />
    </>
  );

  return (
    <group>
      <instancedMesh ref={refs.orb} args={[undefined, undefined, MAX.orb]} frustumCulled={false}>
        <icosahedronGeometry args={[0.2, 2]} />
        <meshBasicMaterial color="#fff0b8" fog={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={refs.orbHalo} args={[undefined, undefined, MAX.orb]} frustumCulled={false} renderOrder={2}>
        {halo('#ff8a24', 0.35, 0.46)}
      </instancedMesh>

      <instancedMesh ref={refs.gem} args={[undefined, undefined, MAX.gem]} frustumCulled={false}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshBasicMaterial color="#8af4ff" fog={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={refs.gemHalo} args={[undefined, undefined, MAX.gem]} frustumCulled={false} renderOrder={2}>
        {halo('#38b6ff', 0.4, 0.5)}
      </instancedMesh>

      <instancedMesh ref={refs.shield} args={[undefined, undefined, MAX.shield]} frustumCulled={false}>
        <cylinderGeometry args={[0.36, 0.36, 0.12, 6]} />
        <meshBasicMaterial color="#6dffb4" fog={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={refs.shieldHalo} args={[undefined, undefined, MAX.shield]} frustumCulled={false} renderOrder={2}>
        {halo('#2fe08a', 0.38, 0.5)}
      </instancedMesh>

      <instancedMesh ref={refs.magnet} args={[undefined, undefined, MAX.magnet]} frustumCulled={false}>
        <torusGeometry args={[0.27, 0.1, 8, 22]} />
        <meshBasicMaterial color="#ff7ae8" fog={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={refs.magnetHalo} args={[undefined, undefined, MAX.magnet]} frustumCulled={false} renderOrder={2}>
        {halo('#e040c8', 0.38, 0.52)}
      </instancedMesh>
    </group>
  );
}
