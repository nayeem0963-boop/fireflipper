import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending } from 'three';
import { getGlowTexture } from '../../utils/textures.js';

/** Trail of glows behind the bird: [x offset, size, opacity], brightest at the bird. */
const FLAME_PUFFS = [
  [-0.1, 1.5, 0.75],
  [-0.55, 1.35, 0.6],
  [-1.0, 1.15, 0.5],
  [-1.4, 0.95, 0.4],
  [-1.75, 0.75, 0.3],
  [-2.05, 0.55, 0.2],
];

/**
 * What makes any bird a fire bird: a halo, a warm light, and a comet-like flame tail that flickers. Lives in the
 * bird's local space, with the bird facing +x; `tailX` is where the tail ends (negative).
 *
 * `palette` needs `glow` (halo and light), and `low` / `mid` / `high` (the tail, brightest to dimmest).
 */
export default function FlameAura({
  palette,
  tailX,
  glow = 0.55,
  lightIntensity = 6,
  lightPosition = [0.2, 0.6, 2.4],
}) {
  const glowMap = useMemo(getGlowTexture, []);
  const flame = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    flame.current?.children.forEach((puff, i) => {
      const flick = 0.85 + 0.2 * Math.sin(t * 17 + i * 2.1) + 0.08 * Math.sin(t * 29 + i);
      const { size, x } = puff.userData;
      puff.scale.set(size * flick, size * 0.55 * flick, 1);
      puff.position.y = Math.sin(t * 7 + i * 1.7) * 0.06 * (i + 1) * 0.4;
      puff.position.x = x * (0.95 + 0.08 * Math.sin(t * 11 + i));
    });
  });

  return (
    <>
      {/* Further out and gentler than a small bird's light: these birds are bigger and would blow out */}
      <pointLight
        color={palette.glow}
        intensity={lightIntensity * 0.55}
        distance={9}
        decay={1.6}
        position={lightPosition}
      />
      <sprite scale={[4.2, 4.2, 1]} renderOrder={-1}>
        <spriteMaterial
          map={glowMap}
          color={palette.glow}
          transparent
          opacity={glow}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      <group ref={flame} position={[tailX * 0.9, 0, 0]}>
        {FLAME_PUFFS.map(([x, size, opacity], i) => (
          <sprite key={i} position={[x, 0, 0]} scale={[size, size * 0.55, 1]} userData={{ size, x }}>
            <spriteMaterial
              map={glowMap}
              color={i < 2 ? palette.high : i < 4 ? palette.mid : palette.low}
              transparent
              opacity={opacity}
              depthWrite={false}
              blending={AdditiveBlending}
              toneMapped={false}
            />
          </sprite>
        ))}
      </group>
    </>
  );
}
