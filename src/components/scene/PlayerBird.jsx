import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Firebird from './Firebird.jsx';

/**
 * The player's firebird, positioned from the simulation each frame
 * (interpolated between fixed physics steps for smooth motion).
 * The bird stays at x = 0; the world scrolls past it.
 *
 * Body language is all visual and lives here: pitch and bank come from the
 * simulation's damped springs, and a brief squash-and-stretch sells each
 * flap. None of it touches the collider (a circle of radius 0.36 at the
 * bird's position), so collision accuracy is unchanged.
 */
const SQUASH_TIME = 0.2; // seconds of stretch after a flap

export default function PlayerBird({ sim }) {
  const group = useRef();
  const body = useRef();

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const bird = sim.bird;
    g.position.y = sim.renderBirdY();
    g.rotation.z = bird.pitch + bird.spin;
    g.rotation.x = bird.roll;

    // Stretch along the flight line as the wings drive down, then relax.
    const u = bird.dead ? 1 : Math.min(1, bird.sinceFlap / SQUASH_TIME);
    const pulse = Math.sin(u * Math.PI) * (1 - u);
    body.current.scale.set(1 + pulse * 0.1, 1 - pulse * 0.07, 1);
    // After a shield takes a hit the bird flickers while it ignores collisions.
    body.current.visible = !(sim.invuln > 0 && Math.sin(sim.time * 80) > 0);
  });

  return (
    <group ref={group}>
      <group ref={body}>
        {/* Scaled so the body matches the 0.36 collision radius; wings and tail don't collide. */}
        <Firebird scale={0.6} rotation={[0, -0.12, 0]} flight={sim.bird} float={0.03} wingSpeed={9} lightIntensity={8} glow={0.6} />
      </group>
    </group>
  );
}
