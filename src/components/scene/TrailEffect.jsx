import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color } from 'three';
import { getNeutralGlowTexture } from '../../utils/textures.js';
import { PHASE } from '../../systems/game/createGameSim.js';

/**
 * A cosmetic trail of glowing beads behind the bird, coloured by the chosen skin (see `trail` in avatars.js).
 * It only reads the bird's position: it has no collision and changes nothing about the simulation.
 *
 * Points are stored in track coordinates (so they stay put in the world while it scrolls) in a ring buffer, and
 * fade by darkening their vertex colour under additive blending (black = invisible), like BurstParticles.
 */
const POINTS = 56;
const SPACING = 0.11; // track distance between samples
const STYLE = {
  flame: { size: 0.4, jitter: 0.03, shimmer: 0 },
  sparks: { size: 0.28, jitter: 0.09, shimmer: 0 },
  shimmer: { size: 0.42, jitter: 0.02, shimmer: 1 },
};

export default function TrailEffect({ sim, trail }) {
  const points = useRef();
  const glowMap = useMemo(getNeutralGlowTexture, []);
  const style = STYLE[trail.style] ?? STYLE.flame;

  const stops = useMemo(() => trail.stops.map((c) => new Color(c)), [trail]);
  const spark = useMemo(() => new Color(trail.spark), [trail]);

  const buf = useMemo(
    () => ({
      head: 0,
      count: 0,
      lastX: -Infinity,
      tx: new Float32Array(POINTS),
      y: new Float32Array(POINTS),
      jit: new Float32Array(POINTS),
      positions: new Float32Array(POINTS * 3),
      colors: new Float32Array(POINTS * 3),
    }),
    [],
  );
  const tmp = useMemo(() => new Color(), []);

  useFrame(() => {
    const pts = points.current;
    if (!pts) return;
    const dist = sim.renderDistance();
    // A new run (distance went backwards) starts with a clean trail.
    if (dist < buf.lastX - 1) {
      buf.count = 0;
      buf.lastX = -Infinity;
    }
    const flying = sim.phase === PHASE.RUNNING;
    if (flying && dist - buf.lastX >= SPACING) {
      const k = buf.head;
      buf.tx[k] = dist - 0.25; // starts just behind the bird
      buf.y[k] = sim.renderBirdY();
      buf.jit[k] = (Math.random() - 0.5) * 2;
      buf.head = (k + 1) % POINTS;
      buf.count = Math.min(POINTS, buf.count + 1);
      buf.lastX = dist;
    }

    const { tx, y, jit, positions, colors } = buf;
    const t = sim.time;
    for (let n = 0; n < POINTS; n++) {
      // n = 0 is the newest point.
      const k = (buf.head - 1 - n + POINTS * 2) % POINTS;
      const i3 = n * 3;
      if (n >= buf.count) {
        colors[i3] = colors[i3 + 1] = colors[i3 + 2] = 0;
        continue;
      }
      const age = n / (POINTS - 1);
      positions[i3] = tx[k] - dist;
      positions[i3 + 1] = y[k] + jit[k] * style.jitter * (0.3 + age * 2) + (style.shimmer ? Math.sin(t * 9 + n * 0.5) * 0.04 * age : 0);
      positions[i3 + 2] = -0.15;
      // Head -> middle -> end colour ramp, with a lively spark every few beads.
      const seg = age * 2;
      if (seg < 1) tmp.copy(stops[0]).lerp(stops[1], seg);
      else tmp.copy(stops[1]).lerp(stops[2], seg - 1);
      if (n % 7 === 3) tmp.lerp(spark, 0.7);
      if (style.shimmer) tmp.offsetHSL(Math.sin(t * 4 + n * 0.35) * 0.03, 0, 0);
      const fade = Math.pow(1 - age, 1.2) * 0.95;
      colors[i3] = tmp.r * fade;
      colors[i3 + 1] = tmp.g * fade;
      colors[i3 + 2] = tmp.b * fade;
    }
    pts.visible = buf.count > 0;
    pts.geometry.attributes.position.needsUpdate = true;
    pts.geometry.attributes.color.needsUpdate = true;
  });

  return (
    <points ref={points} frustumCulled={false} visible={false} renderOrder={-1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[buf.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[buf.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={glowMap}
        size={style.size}
        sizeAttenuation
        vertexColors
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
