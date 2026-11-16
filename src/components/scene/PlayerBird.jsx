import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Firebird from './Firebird.jsx';

/**
 * The player's firebird, positioned from the simulation each frame
 * (interpolated between fixed physics steps for smooth motion).
 * The bird stays at x = 0; the world scrolls past it.
 */
export default function PlayerBird({ sim }) {
  const group = useRef();

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.position.y = sim.renderBirdY();
    g.rotation.z = sim.bird.pitch + sim.bird.spin;
  });

  return (
    <group ref={group}>
      {/* Scaled so the body matches the 0.36 collision radius; wings and tail don't collide. */}
      <Firebird scale={0.6} rotation={[0, -0.12, 0]} flight={sim.bird} float={0.03} wingSpeed={9} lightIntensity={8} glow={0.6} />
    </group>
  );
}
