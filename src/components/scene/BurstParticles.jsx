import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending } from 'three';
import { getGlowTexture, getNeutralGlowTexture } from '../../utils/textures.js';
import { useTheme } from '../../hooks/useTheme.js';
import { GAME_EVENTS, gameEvents } from '../../systems/events/gameEvents.js';
import { useSkin } from '../../hooks/useSkin.js';
import { Color } from 'three';

/**
 * Pooled spark bursts for orb pickups and crashes: one THREE.Points with
 * a fixed-size ring buffer of particles. Fading uses vertex colours under
 * additive blending (black = invisible), so no custom shader is needed.
 * Positions are kept in track coordinates so sparks stay put in the world
 * while it scrolls.
 */
const CAPACITY = 160;
/** Every this many orbs in a streak, the pickup bursts bigger (a collectible flourish, cosmetic only). */
const STREAK_FLOURISH = 5;

export default function BurstParticles({ sim }) {
  const points = useRef();
  const theme = useTheme();
  const glowMap = useMemo(() => (theme.neutralGlow ? getNeutralGlowTexture() : getGlowTexture()), [theme]);
  const { trail } = useSkin();
  // The pickup effect is tinted with the chosen bird's trail colours.
  const orbColors = useMemo(() => {
    const c = (hex) => {
      const col = new Color(hex);
      return [col.r, col.g, col.b];
    };
    return { main: c(trail.stops[0]), accent: c(trail.spark), edge: c(trail.stops[1]) };
  }, [trail]);

  const state = useMemo(
    () => ({
      next: 0,
      tx: new Float32Array(CAPACITY), // track x
      y: new Float32Array(CAPACITY),
      vx: new Float32Array(CAPACITY),
      vy: new Float32Array(CAPACITY),
      life: new Float32Array(CAPACITY),
      maxLife: new Float32Array(CAPACITY).fill(1),
      base: new Float32Array(CAPACITY * 3),
      positions: new Float32Array(CAPACITY * 3),
      colors: new Float32Array(CAPACITY * 3),
    }),
    [],
  );

  useEffect(() => {
    const emit = (x, y, count, speed, color, life) => {
      for (let i = 0; i < count; i++) {
        const k = state.next;
        state.next = (state.next + 1) % CAPACITY;
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.6);
        state.tx[k] = x;
        state.y[k] = y;
        state.vx[k] = Math.cos(a) * s;
        state.vy[k] = Math.sin(a) * s + speed * 0.25;
        state.maxLife[k] = state.life[k] = life * (0.6 + Math.random() * 0.4);
        state.base[k * 3] = color[0];
        state.base[k * 3 + 1] = color[1];
        state.base[k * 3 + 2] = color[2];
      }
    };
    const offOrb = gameEvents.on(GAME_EVENTS.ORB, (e) => {
      emit(e.x, e.y, 10, 3.2, orbColors.main, 0.55);
      emit(e.x, e.y, 6, 2.4, orbColors.accent, 0.7);
      if (e.streak > 0 && e.streak % STREAK_FLOURISH === 0) {
        // Streak flourish: an extra ring of sparks in the bird's colours.
        emit(e.x, e.y, 24, 5.2, orbColors.edge, 0.8);
        emit(e.x, e.y, 12, 3.6, orbColors.main, 0.9);
      }
    });
    const offCrash = gameEvents.on(GAME_EVENTS.CRASH, (e) => emit(e.x, e.y, 42, 5.5, theme.scene.crash, 0.9));
    return () => {
      offOrb();
      offCrash();
    };
  }, [state, orbColors, theme]);

  useFrame((_, delta) => {
    const geom = points.current?.geometry;
    if (!geom) return;
    const dt = Math.min(delta, 0.05);
    const dist = sim.renderDistance();
    const { tx, y, vx, vy, life, maxLife, base, positions, colors } = state;
    let anyAlive = false;
    for (let i = 0; i < CAPACITY; i++) {
      const i3 = i * 3;
      if (life[i] <= 0) {
        colors[i3] = colors[i3 + 1] = colors[i3 + 2] = 0;
        continue;
      }
      anyAlive = true;
      life[i] -= dt;
      vy[i] -= 6 * dt;
      vx[i] *= 1 - 2.5 * dt;
      tx[i] += vx[i] * dt;
      y[i] += vy[i] * dt;
      const k = Math.max(0, life[i] / maxLife[i]);
      positions[i3] = tx[i] - dist;
      positions[i3 + 1] = y[i];
      positions[i3 + 2] = 0.4;
      colors[i3] = base[i3] * k;
      colors[i3 + 1] = base[i3 + 1] * k;
      colors[i3 + 2] = base[i3 + 2] * k;
    }
    points.current.visible = anyAlive;
    if (!anyAlive) return;
    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
  });

  return (
    <points ref={points} frustumCulled={false} visible={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[state.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[state.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={glowMap}
        size={0.32}
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
