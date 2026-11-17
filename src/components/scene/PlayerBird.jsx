import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending } from 'three';
import AvatarBird from './AvatarBird.jsx';
import { useSkin } from '../../hooks/useSkin.js';
import { POWERUP_INFO } from '../../systems/powerups/appearance.js';

/**
 * The player's firebird, positioned from the simulation each frame
 * (interpolated between fixed physics steps for smooth motion).
 * The bird stays at x = 0; the world scrolls past it.
 */
export default function PlayerBird({ sim }) {
  const group = useRef();
  const skin = useSkin();
  const bubble = useRef();

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.position.y = sim.renderBirdY();
    g.rotation.z = sim.bird.pitch + sim.bird.spin;

    const b = bubble.current;
    if (b) {
      // Visible while the shield is up, and flickering during the grace period after it breaks.
      const { shield, invuln } = sim.power;
      b.visible = shield || (invuln > 0 && Math.floor(sim.time * 20) % 2 === 0);
      const pulse = 1 + Math.sin(sim.time * 7) * 0.04;
      b.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={group}>
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
      <mesh ref={bubble} visible={false} renderOrder={3}>
        <icosahedronGeometry args={[0.62, 2]} />
        <meshBasicMaterial
          color={POWERUP_INFO.shield.color}
          transparent
          opacity={0.3}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
