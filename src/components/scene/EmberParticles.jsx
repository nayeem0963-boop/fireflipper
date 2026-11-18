import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending } from 'three';
import { getGlowTexture } from '../../utils/textures.js';
import { envState, environmentAt } from '../../systems/world/environments.js';

/**
 * Atmospheric particles as a single THREE.Points draw call: rising embers in the plains, tan
 * dust in the canyon, drifting motes over the islands, a dense swarm of sparks in the burning
 * forest, falling ash blown sideways in the storm. Positions are mutated in place each frame (no
 * allocations), which scales to hundreds of particles on mobile GPUs.
 *
 * Which of these you see follows the journey's blended environment: colour, size, how many are
 * drawn (draw range, no reallocation), whether they rise or fall, and how hard the wind pushes
 * them all change continuously.
 *
 * Props:
 *  - count:   particles at the baseline density (capacity is a bit over twice this)
 *  - area:    [width, height, depth] of the spawn box, centred on the group
 *  - scroll:  optional () => number giving horizontal world speed (parallax)
 *  - sim:     the simulation, for the current distance
 */
const CAPACITY_FACTOR = 2.4;
const WIND_SPEED = 9; // units/s at full wind

export default function EmberParticles({ count = 120, area = [14, 9, 6], size = 0.13, scroll, sim, ...props }) {
  const points = useRef();
  const material = useRef();
  const [w, h, d] = area;
  const capacity = Math.round(count * CAPACITY_FACTOR);

  const { positions, speeds, seeds } = useMemo(() => {
    const positions = new Float32Array(capacity * 3);
    const speeds = new Float32Array(capacity);
    const seeds = new Float32Array(capacity);
    for (let i = 0; i < capacity; i++) {
      positions[i * 3] = (Math.random() - 0.5) * w;
      positions[i * 3 + 1] = (Math.random() - 0.5) * h;
      positions[i * 3 + 2] = (Math.random() - 0.5) * d;
      speeds[i] = 0.35 + Math.random() * 0.9;
      seeds[i] = Math.random() * Math.PI * 2;
    }
    return { positions, speeds, seeds };
  }, [capacity, w, h, d]);

  const glowMap = useMemo(getGlowTexture, []);

  useFrame((state, delta) => {
    const geom = points.current?.geometry;
    if (!geom) return;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const e = environmentAt(sim ? sim.renderDistance() : 0, envState);
    const p = e.particles;
    const n = Math.min(capacity, Math.max(1, Math.round(count * p.count)));
    geom.setDrawRange(0, n);
    material.current.color.setRGB(p.color[0], p.color[1], p.color[2]);
    material.current.size = p.size * (size / 0.13);

    const sx = scroll ? scroll() * dt : 0;
    const wind = p.wind * WIND_SPEED * dt;
    const halfW = w / 2;
    const halfH = h / 2;
    const rise = p.rise;

    for (let i = 0; i < n; i++) {
      const ix = i * 3;
      // Wind drags harder on lighter (faster-seeded) particles, so the flow looks layered, not rigid.
      positions[ix] += Math.sin(t * 0.9 + seeds[i]) * 0.25 * dt - sx - wind * (0.6 + speeds[i] * 0.5);
      positions[ix + 1] += speeds[i] * rise * dt;
      if (positions[ix + 1] > halfH) {
        positions[ix + 1] = -halfH;
        positions[ix] = (Math.random() - 0.5) * w;
      } else if (positions[ix + 1] < -halfH) {
        positions[ix + 1] = halfH;
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
        ref={material}
        map={glowMap}
        color="#ffae4a"
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
