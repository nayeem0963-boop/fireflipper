import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending } from 'three';
import { getGlowTexture, getNeutralGlowTexture } from '../../utils/textures.js';
import { useTheme } from '../../hooks/useTheme.js';

/**
 * Rising embers as a single THREE.Points draw call. Positions are mutated
 * in place each frame (no allocations), which scales to hundreds of
 * particles cheaply on mobile GPUs.
 *
 * Props:
 *  - count:   number of embers
 *  - area:    [width, height, depth] of the spawn box, centred on the group
 *  - scroll:  optional () => number giving horizontal world speed (parallax)
 */
export default function EmberParticles({ count = 120, area = [14, 9, 6], size = 0.13, scroll, color, ...props }) {
  const theme = useTheme();
  const points = useRef();
  const [w, h, d] = area;

  const { positions, speeds, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * w;
      positions[i * 3 + 1] = (Math.random() - 0.5) * h;
      positions[i * 3 + 2] = (Math.random() - 0.5) * d;
      speeds[i] = 0.35 + Math.random() * 0.9;
      seeds[i] = Math.random() * Math.PI * 2;
    }
    return { positions, speeds, seeds };
  }, [count, w, h, d]);

  const glowMap = useMemo(() => (theme.neutralGlow ? getNeutralGlowTexture() : getGlowTexture()), [theme]);

  useFrame((state, delta) => {
    const geom = points.current?.geometry;
    if (!geom) return;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const sx = scroll ? scroll() * dt : 0;
    const halfW = w / 2;
    const halfH = h / 2;

    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      positions[ix] += Math.sin(t * 0.9 + seeds[i]) * 0.25 * dt - sx;
      positions[ix + 1] += speeds[i] * dt;
      if (positions[ix + 1] > halfH) {
        positions[ix + 1] = -halfH;
        positions[ix] = (Math.random() - 0.5) * w;
      }
      if (positions[ix] < -halfW) positions[ix] += w;
    }
    geom.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={points} {...props} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={glowMap}
        color={color ?? theme.scene.ember}
        size={size}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
