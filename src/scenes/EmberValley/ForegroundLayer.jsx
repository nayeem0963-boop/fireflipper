import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DodecahedronGeometry, OctahedronGeometry, Object3D } from 'three';
import { ZONE_IDS, zoneWeight, BIOMES } from '../../systems/world/biomes.js';
import { foregroundBaseY, foregroundHeight, foregroundItems, foregroundX, foregroundZ } from '../../systems/world/foreground.js';

/**
 * Foreground props along the bottom edge of the screen (see systems/world/foreground.js for the safety rule): low rocks in the canyon,
 * snow mounds in the polar zone, glowing crystals in the Celestial City and blossom bushes in the palace gardens. One instanced mesh
 * per zone, shown only while that zone is live. Purely visual, no collision, nothing here touches the simulation.
 */
const LOOKS = {
  canyon: { make: () => new DodecahedronGeometry(0.5, 0), squash: 0.55, color: '#7a2e1c', emissive: '#000000', seed: 101 },
  arctic: { make: () => new DodecahedronGeometry(0.5, 0), squash: 0.5, color: '#e6f0f7', emissive: '#6a86a8', seed: 202 },
  celestial: { make: () => new OctahedronGeometry(0.5, 0), squash: 1.5, color: '#9a8cff', emissive: '#7a78c8', seed: 303 },
  palace: { make: () => new DodecahedronGeometry(0.5, 1), squash: 0.7, color: '#e58aa8', emissive: '#ffb0c8', seed: 404 },
  sanctuary: { make: () => new DodecahedronGeometry(0.5, 1), squash: 0.6, color: '#fff2fa', emissive: '#d8c8ff', seed: 505 },
};

function ZoneForeground({ sim, zoneId }) {
  const look = LOOKS[zoneId];
  const zone = BIOMES[zoneId];
  const mesh = useRef();
  const group = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const geometry = useMemo(() => look.make(), [look]);
  const items = useMemo(() => foregroundItems(look.seed), [look]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    const base = new Color(look.color);
    const c = new Color();
    items.forEach((it, i) => mesh.current.setColorAt(i, c.copy(base).multiplyScalar(it.shade)));
    mesh.current.instanceColor.needsUpdate = true;
  }, [items, look]);
  useFrame(({ camera }) => {
    const d = sim.renderDistance();
    const w = zoneWeight(zone, d);
    group.current.visible = w > 0.001;
    if (w <= 0.001) return;
    const fov = camera.fov;
    const z = foregroundZ(camera.position.z);
    const baseY = foregroundBaseY();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      // stands on the floor; its height is its preferred screen height, cut to stay under the safe line, grown in with the zone
      const hWorld = foregroundHeight(it.h, camera.position.y, camera.position.z, fov) * w;
      // the geometry is 1 unit tall; `squash` sets how wide it is relative to its height
      const wide = (Math.max(hWorld, 0.001) * it.w) / look.squash;
      dummy.position.set(camera.position.x + foregroundX(it, d), baseY + hWorld / 2, z);
      dummy.rotation.set(0, it.rot, 0);
      dummy.scale.set(wide, Math.max(hWorld, 0.0001), wide);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group ref={group} visible={false}>
      <instancedMesh ref={mesh} args={[undefined, undefined, items.length]} frustumCulled={false}>
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial flatShading roughness={0.95} emissive={look.emissive} emissiveIntensity={zoneId === 'canyon' ? 0 : 0.35} />
      </instancedMesh>
    </group>
  );
}

export default function ForegroundLayer({ sim }) {
  return (
    <>
      {ZONE_IDS.map((id) => (
        <ZoneForeground key={id} sim={sim} zoneId={id} />
      ))}
    </>
  );
}
