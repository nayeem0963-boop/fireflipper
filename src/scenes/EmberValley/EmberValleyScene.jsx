import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils } from 'three';
import Firebird from '../../components/scene/Firebird.jsx';
import EmberParticles from '../../components/scene/EmberParticles.jsx';
import { useRenderSettings } from '../../hooks/useRenderSettings.js';
import { useDistanceTracker } from '../../systems/scoring/useDistanceTracker.js';
import { useGameStore, STATUS } from '../../store/useGameStore.js';
import { PHYSICS } from '../../systems/physics/constants.js';
import { runtime } from '../../systems/runtime.js';
import { createGroundTexture, createSkyTexture } from './valleyTextures.js';

/**
 * Ember Valley: the first level. In this pass it is a scrolling backdrop
 * only (no obstacles, no flight physics). Level geometry reads
 * `runtime.distance` so everything scrolls in lock-step with scoring.
 */
const GROUND_Y = -3.2;
const MOUNTAIN_SPAN = 60;
const BASE_CAMERA_Z = 10;

const isRunning = () => useGameStore.getState().status === STATUS.RUNNING;
const worldSpeed = () => (isRunning() ? PHYSICS.worldSpeed : 0);

export default function EmberValleyScene() {
  const { emberCount } = useRenderSettings();
  useDistanceTracker();

  return (
    <>
      <fog attach="fog" args={['#120806', 12, 48]} />
      <ambientLight intensity={0.2} color="#ffb27a" />
      <hemisphereLight args={['#ff8a3a', '#0a0503', 0.55]} />
      <directionalLight position={[-6, 8, 4]} intensity={0.9} color="#ffcf9a" />

      <Sky />
      <MountainLayer depth={-30} scale={7} count={9} speedFactor={0.12} color="#1d0c07" seed={1} />
      <MountainLayer depth={-18} scale={4.5} count={10} speedFactor={0.3} color="#2a1009" seed={7} />
      <Ground />

      {/* Placeholder player: fixed position, no physics yet */}
      <Player />

      <EmberParticles count={emberCount} area={[26, 12, 10]} position={[0, 0, -2]} scroll={() => worldSpeed() * 0.6} />
    </>
  );
}

/**
 * Frames the player for any aspect ratio: on portrait screens the camera
 * pulls back and the bird moves toward the centre so it never clips.
 * The bird sits ~30% in from the left on wide screens (look-ahead room).
 */
function Player() {
  const group = useRef();
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    camera.position.z = aspect < 1 ? BASE_CAMERA_Z + (1 - aspect) * 7 : BASE_CAMERA_Z;
    camera.updateProjectionMatrix();
    const halfWidth = Math.tan(MathUtils.degToRad(camera.fov / 2)) * camera.position.z * aspect;
    if (group.current) group.current.position.x = -Math.min(2.6, halfWidth * 0.4);
  }, [camera, size]);

  return (
    <group ref={group} position={[-2.2, 0.4, 0]}>
      <Firebird rotation={[0, -0.15, 0]} float={0.25} wingSpeed={8} lightIntensity={8} />
    </group>
  );
}

function Sky() {
  const tex = useMemo(createSkyTexture, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[0, 6, -45]}>
      <planeGeometry args={[220, 40]} />
      <meshBasicMaterial map={tex} fog={false} toneMapped={false} />
    </mesh>
  );
}

function Ground() {
  const tex = useMemo(() => {
    const t = createGroundTexture();
    t.repeat.set(40, 20);
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);

  useFrame(() => {
    // 1 texture repeat covers (planeWidth / repeat.x) world units.
    tex.offset.x = (runtime.distance / (160 / 40)) % 1;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, -20]}>
      <planeGeometry args={[160, 80]} />
      <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ff6a1a" emissiveIntensity={0.35} roughness={0.9} />
    </mesh>
  );
}

/** Deterministic pseudo-random so mountain layouts are stable across renders. */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * A wrapping band of cone "mountains" scrolled at a fraction of world
 * speed for parallax. A future pass can replace these with instanced GLB
 * rock meshes.
 */
function MountainLayer({ depth, scale, count, speedFactor, color, seed }) {
  const group = useRef();
  const peaks = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: count }, (_, i) => ({
      x: (i / count) * MOUNTAIN_SPAN - MOUNTAIN_SPAN / 2 + rand() * 3,
      h: scale * (0.8 + rand() * 0.9),
      r: scale * (0.7 + rand() * 0.5),
    }));
  }, [count, scale, seed]);

  useFrame(() => {
    if (!group.current) return;
    const offset = (runtime.distance * speedFactor) % MOUNTAIN_SPAN;
    group.current.children.forEach((mesh, i) => {
      let x = peaks[i].x - offset;
      if (x < -MOUNTAIN_SPAN / 2) x += MOUNTAIN_SPAN;
      mesh.position.x = x;
    });
  });

  return (
    <group ref={group} position={[0, GROUND_Y, depth]}>
      {peaks.map((p, i) => (
        <mesh key={i} position={[p.x, p.h / 2, 0]}>
          <coneGeometry args={[p.r, p.h, 5]} />
          <meshStandardMaterial color={color} emissive="#3a1206" emissiveIntensity={0.4} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}
