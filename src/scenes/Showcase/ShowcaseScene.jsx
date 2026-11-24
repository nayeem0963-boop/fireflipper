import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import AvatarBird from '../../components/scene/AvatarBird.jsx';
import PlayerAvatar from '../../components/scene/PlayerAvatar.jsx';
import { useSkin } from '../../hooks/useSkin.js';
import { useGameVersion } from '../../hooks/useGameVersion.js';
import { PREVIEW_SIZE_FACTOR, usesOriginalAvatar } from '../../systems/versions/versions.js';
import EmberParticles from '../../components/scene/EmberParticles.jsx';
import { useTheme } from '../../hooks/useTheme.js';
import { useRenderSettings } from '../../hooks/useRenderSettings.js';
import { damp } from '../../utils/math.js';

/**
 * Menu-screen scene: the firebird hovering in a ring of fire with drifting
 * embers. Kept separate from gameplay levels so the menu can evolve
 * (skins, unlock previews) without touching level code.
 */
export default function ShowcaseScene() {
  const { emberCount } = useRenderSettings();
  const skin = useSkin();
  const version = useGameVersion();
  const { scene } = useTheme();

  return (
    <>
      <ambientLight intensity={0.25} color={scene.ambient} />
      <hemisphereLight args={[scene.hemiSky, scene.hemiGround, 0.6]} />
      <directionalLight position={[-4, 5, 3]} intensity={1.1} color={scene.key} />

      <CameraParallax />

      <group position={[0, 0.1, 0]}>
        {usesOriginalAvatar(version) ? (
          <AvatarBird avatar={skin} rotation={[0, -0.55, 0]} float={0.16} wingSpeed={5.5} />
        ) : (
          <PlayerAvatar
            version={version}
            sizeFactor={PREVIEW_SIZE_FACTOR}
            rotation={[0, -0.55, 0]}
            float={0.16}
            wingSpeed={5.5}
          />
        )}
        <FireRing a={scene.ringA} b={scene.ringB} />
      </group>

      <EmberParticles count={Math.round(emberCount * 0.75)} color={scene.ember} area={[12, 8, 6]} position={[0, 0, -1]} />
    </>
  );
}

/** Thin glowing rings slowly rotating behind the bird. */
function FireRing({ a, b }) {
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
        <meshBasicMaterial color={a} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, 0, 0.6]}>
        <torusGeometry args={[2.45, 0.008, 6, 128, Math.PI * 1.4]} />
        <meshBasicMaterial color={b} transparent opacity={0.5} toneMapped={false} />
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
