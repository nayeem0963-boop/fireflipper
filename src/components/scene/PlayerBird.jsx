import { useMemo, useRef } from 'react';
import { DoubleSide } from 'three';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending } from 'three';
import PlayerAvatar from './PlayerAvatar.jsx';
import TrailEffect from './TrailEffect.jsx';
import { useSkin } from '../../hooks/useSkin.js';
import { useGameVersion } from '../../hooks/useGameVersion.js';
import { isUpright, trailForVersion } from '../../systems/versions/versions.js';
import { WORLD } from '../../systems/physics/constants.js';

/**
 * The player's firebird, positioned from the simulation each frame
 * (interpolated between fixed physics steps for smooth motion).
 * The bird stays at x = 0; the world scrolls past it. This component only places the player from the simulation; what the
 * player looks like is <PlayerAvatar> (it depends on the game version and never affects the collider).
 */
export default function PlayerBird({ sim }) {
  const group = useRef();
  const bubble = useRef();
  const bubbleMat = useRef();
  const shadow = useRef();
  const shadowMat = useRef();
  const skin = useSkin();
  const version = useGameVersion();
  const upright = isUpright(version);
  const trail = useMemo(() => trailForVersion(version, skin.trail), [version, skin.trail]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.position.y = sim.renderBirdY();
    // A flying bird pitches along its path and tumbles when it crashes; a running model (upright) stays on its feet.
    g.rotation.z = upright ? 0 : sim.bird.pitch + sim.bird.spin;
    // A runner's soft shadow on the land under her feet: it shrinks and fades as she leaves the ground.
    const sh = shadow.current;
    if (sh) {
      const h = Math.max(0, g.position.y - WORLD.groundY);
      const k = 1 / (1 + h * 0.5);
      sh.scale.set(1.5 * k, 1, 0.6 * k);
      if (shadowMat.current) shadowMat.current.opacity = 0.32 * k * (sim.bird.dead ? 0.5 : 1);
    }
    // The shield: a soft bubble round the bird while it is held, flickering during the immunity after it took a crash. Looks only (the hitbox is the simulation's).
    const b = bubble.current;
    if (b) {
      const on = sim.shield || sim.grace > 0;
      b.visible = on;
      if (on && bubbleMat.current) bubbleMat.current.opacity = sim.grace > 0 ? (Math.sin(sim.time * 36) > 0 ? 0.3 : 0.08) : sim.shieldLeft > 0 && sim.shieldLeft <= 3 ? (Math.sin(sim.time * 14) > 0 ? 0.22 : 0.07) : 0.2 + Math.sin(sim.time * 3) * 0.05; // blinks in its last 3 s
    }
  });

  return (
    <>
      <TrailEffect sim={sim} trail={trail} lift={upright ? 1.1 : 0} />
      {upright && (
        <mesh ref={shadow} position={[0, WORLD.groundY + 0.13, 0.1]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
          <circleGeometry args={[0.5, 24]} />
          <meshBasicMaterial ref={shadowMat} color="#000000" transparent opacity={0.3} depthWrite={false} side={DoubleSide} toneMapped={false} />
        </mesh>
      )}
      <group ref={group}>
      <mesh ref={bubble} position={[0, 0, -0.3]} visible={false}>
        <circleGeometry args={[0.8, 32]} />
        <meshBasicMaterial ref={bubbleMat} color="#9fe8ff" transparent opacity={0.2} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      {/* Scaled (by the version's playerConfig) so the body matches the 0.36 collision radius; wings and tail don't collide. */}
      <PlayerAvatar
        version={version}
        playerState={sim.bird}
        rotation={[0, -0.12, 0]}
        float={0.03}
        wingSpeed={9}
        lightIntensity={8}
        glow={0.6}
      />
      </group>
    </>
  );
}
