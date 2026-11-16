import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Firebird from '../../components/scene/Firebird.jsx';
import EmberParticles from '../../components/scene/EmberParticles.jsx';
import { useRenderSettings } from '../../hooks/useRenderSettings.js';
import { damp } from '../../utils/math.js';

/**
 * Menu-screen scene: the firebird hovering in a ring of fire with drifting
 * embers. Kept separate from gameplay levels so the menu can evolve
 * (skins, unlock previews) without touching level code.
 */
export default function ShowcaseScene() {
  const { emberCount } = useRenderSettings();

  return (
    <>
      <ambientLight intensity={0.25} color="#ffb27a" />
      <hemisphereLight args={['#ff9a4a', '#120805', 0.6]} />
      <directionalLight position={[-4, 5, 3]} intensity={1.1} color="#ffd2a0" />

      <CameraParallax />

      <group position={[0, 0.1, 0]}>
        <Firebird rotation={[0, -0.55, 0]} float={0.16} wingSpeed={5.5} />
        <FireRing />
      </group>

      <EmberParticles count={Math.round(emberCount * 0.75)} area={[12, 8, 6]} position={[0, 0, -1]} />
    </>
  );
}

/** Thin glowing rings slowly rotating behind the bird. */
function FireRing() {
  const ring = useRef();
  useFrame((state) => {
    if (!ring.current) return;
    const t = state.clock.elapsedTime;
    ring.current.rotation.z = t * 0.15;
    ring.current.rotation.x = Math.sin(t * 0.3) * 0.08;
  });
  return (
    <group ref={ring} position={[0, 0, -1.2]}>
      <mesh>
        <torusGeometry args={[2.1, 0.022, 8, 128]} />
        <meshBasicMaterial color="#ff8a2a" transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, 0, 0.6]}>
        <torusGeometry args={[2.45, 0.008, 6, 128, Math.PI * 1.4]} />
        <meshBasicMaterial color="#ffc46b" transparent opacity={0.5} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Subtle camera drift that follows the pointer for depth. */
function CameraParallax() {
  useFrame((state, delta) => {
    const { camera, pointer, size } = state;
    const k = damp(2.5, delta);
    // Pull back on narrow/portrait stages so the ring stays in frame.
    const aspect = size.width / Math.max(1, size.height);
    const targetZ = aspect < 1.1 ? 6 + (1.1 - aspect) * 5 : 6;
    camera.position.x += (pointer.x * 0.5 - camera.position.x) * k;
    camera.position.y += (0.25 + pointer.y * 0.3 - camera.position.y) * k;
    camera.position.z += (targetZ - camera.position.z) * k;
    camera.lookAt(0, 0.1, 0);
  });
  return null;
}
