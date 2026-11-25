import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import AvatarBird from '../../components/scene/AvatarBird.jsx';
import PlayerAvatar from '../../components/scene/PlayerAvatar.jsx';
import { useSkin } from '../../hooks/useSkin.js';
import { useGameVersion } from '../../hooks/useGameVersion.js';
import { previewSizeFactor, usesOriginalAvatar } from '../../systems/versions/versions.js';
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
          skin.kind === 'flamebird' ? (
            <DisplaySpin>
              <AvatarBird avatar={skin} float={0.16} wingSpeed={5.5} />
            </DisplaySpin>
          ) : (
            <AvatarBird avatar={skin} rotation={[0, -0.55, 0]} float={0.16} wingSpeed={5.5} />
          )
        ) : (
          <PlayerAvatar
            version={version}
            sizeFactor={previewSizeFactor(version)}
            // an avatar that stands on its origin is lifted so its body (not its feet) sits at the ring's centre
            position={[0, -(version.playerConfig.centre ?? 0) * version.playerConfig.scale[1] * previewSizeFactor(version), 0]}
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

const SPIN_SPEED = 0.9; // radians per second: a slow turn all the way round
const FLIP_EVERY = 6.5; // seconds between flips
const FLIP_TIME = 0.9; // seconds for one flip
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

/**
 * FlameBird on the home display: it turns slowly all the way round, and every FLIP_EVERY seconds does a quick
 * somersault with a little hop. Only the menu display: in a run the bird keeps its flying orientation.
 */
function DisplaySpin({ children }) {
  const g = useRef();
  useFrame((state) => {
    if (!g.current) return;
    const t = state.clock.elapsedTime;
    const p = (t % FLIP_EVERY) / FLIP_TIME; // 0..1 during a flip
    const flipping = p < 1;
    const e = flipping ? easeInOut(p) : 0;
    g.current.rotation.set(-e * Math.PI * 2, t * SPIN_SPEED, 0, 'YXZ');
    g.current.position.y = flipping ? Math.sin(Math.PI * p) * 0.35 : 0;
  });
  return <group ref={g}>{children}</group>;
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
