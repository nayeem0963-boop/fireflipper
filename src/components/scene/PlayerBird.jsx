import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending } from 'three';
import AvatarBird from './AvatarBird.jsx';
import TrailEffect from './TrailEffect.jsx';
import { useSkin } from '../../hooks/useSkin.js';

/**
 * The player's firebird, positioned from the simulation each frame
 * (interpolated between fixed physics steps for smooth motion).
 * The bird stays at x = 0; the world scrolls past it.
 */
export default function PlayerBird({ sim }) {
  const group = useRef();
  const bubble = useRef();
  const bubbleMat = useRef();
  const skin = useSkin();

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.position.y = sim.renderBirdY();
    g.rotation.z = sim.bird.pitch + sim.bird.spin;
    // The shield: a soft bubble round the bird while it is held, flickering during the immunity after it took a crash. Looks only (the hitbox is the simulation's).
    const b = bubble.current;
    if (b) {
      const on = sim.shield || sim.grace > 0;
      b.visible = on;
      if (on && bubbleMat.current) bubbleMat.current.opacity = sim.grace > 0 ? (Math.sin(sim.time * 36) > 0 ? 0.3 : 0.08) : 0.2 + Math.sin(sim.time * 3) * 0.05;
    }
  });

  return (
    <>
      <TrailEffect sim={sim} trail={skin.trail} />
      <group ref={group}>
      <mesh ref={bubble} position={[0, 0, -0.3]} visible={false}>
        <circleGeometry args={[0.8, 32]} />
        <meshBasicMaterial ref={bubbleMat} color="#9fe8ff" transparent opacity={0.2} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      {/* Scaled so the body matches the 0.36 collision radius; wings and tail don't collide. */}
      <AvatarBird
        avatar={skin}
        scale={0.6}
        rotation={[0, -0.12, 0]}
        flight={sim.bird}
        float={0.03}
        wingSpeed={9}
        lightIntensity={8}
        glow={0.6}
      />
      </group>
    </>
  );
}
