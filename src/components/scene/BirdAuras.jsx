import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending } from 'three';
import { POWERUPS } from '../../systems/physics/constants.js';

/**
 * Power-up effects drawn around the bird, from simulation state:
 *  - shield: a soft green bubble while one is held; it pulses faster as the bird is in danger
 *  - magnet: two rings that sweep inward across the pull radius, so the reach is visible
 * Purely visual. Positioned at the bird, not in the world, and kept low-contrast so the
 * obstacles ahead stay the brightest thing on screen.
 */
export default function BirdAuras({ sim }) {
  const bubble = useRef();
  const bubbleMat = useRef();
  const ringA = useRef();
  const ringB = useRef();
  const ringMatA = useRef();
  const ringMatB = useRef();
  const phase = useMemo(() => ({ t: 0 }), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    phase.t += dt;
    const y = sim.renderBirdY();

    if (bubble.current) {
      const on = sim.shield && !sim.bird.dead;
      bubble.current.visible = on;
      if (on) {
        const pulse = 1 + Math.sin(phase.t * 5) * 0.04;
        bubble.current.position.set(0, y, 0.1);
        bubble.current.scale.setScalar(0.78 * pulse);
        bubbleMat.current.opacity = 0.2 + Math.sin(phase.t * 5) * 0.05;
      }
    }

    const magnet = sim.magnetTime > 0 && !sim.bird.dead;
    const ending = sim.magnetTime < 1.5; // flicker as it is about to run out
    const show = magnet && (!ending || Math.sin(phase.t * 24) > -0.2);
    [[ringA, ringMatA, 0], [ringB, ringMatB, 0.5]].forEach(([ref, mat, offset]) => {
      if (!ref.current) return;
      ref.current.visible = show;
      if (!show) return;
      // Sweeps inward: starts at the pull radius and shrinks to the bird.
      const u = (phase.t * 0.9 + offset) % 1;
      const r = POWERUPS.magnetRadius * (1 - u) + 0.3;
      ref.current.position.set(0, y, 0.05);
      ref.current.scale.set(r, r, 1);
      mat.current.opacity = 0.35 * u * (1 - u * 0.2);
    });
  });

  return (
    <group>
      <mesh ref={bubble} visible={false} renderOrder={4}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial ref={bubbleMat} color="#58ffb0" transparent opacity={0.2} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      {[
        [ringA, ringMatA],
        [ringB, ringMatB],
      ].map(([ref, mat], i) => (
        <mesh key={i} ref={ref} visible={false} renderOrder={3}>
          <ringGeometry args={[0.94, 1, 56]} />
          <meshBasicMaterial ref={mat} color="#ff6ae0" transparent opacity={0.3} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
