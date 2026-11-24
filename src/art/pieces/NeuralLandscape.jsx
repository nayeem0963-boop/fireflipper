import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color } from 'three';
import { usePaletteColors } from '../usePalette.js';

/**
 * Neural Landscape: a square grid of glowing points whose height rolls in waves, with the colour of each point following its
 * height through the palette (dark in the troughs, light on the crests). Heights and colours are written straight into the
 * geometry's arrays each frame. Two patterns: crossing sine waves, or ripples spreading from the centre. The grid is
 * smaller on the low quality tier.
 */
export default function NeuralLandscape({ params, palette, clock, quality }) {
  const { pattern, grid, spacing, amplitude, frequency, size, opacity } = params;
  const { colors } = usePaletteColors(palette);
  const n = quality === 'low' ? Math.min(grid, 70) : grid;
  const tint = useMemo(() => new Color(), []);
  const geoRef = useRef();

  // The grid is made once per size or spacing, not on every render.
  const geometry = useMemo(() => {
    const positions = new Float32Array(n * n * 3);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const k = (i * n + j) * 3;
        positions[k] = (i - (n - 1) / 2) * spacing;
        positions[k + 2] = (j - (n - 1) / 2) * spacing;
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(positions, 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(n * n * 3), 3));
    return g;
  }, [n, spacing]);
  useEffect(() => {
    geoRef.current = geometry;
    return () => geometry.dispose();
  }, [geometry]);

  // Troughs to crests through the palette. The darkest palette colour is left out: dark points vanish under additive blending.
  const ramp = useMemo(() => [colors[0], colors[1], colors[2], new Color().copy(colors[2]).lerp(new Color('#ffffff'), 0.6)], [colors]);

  useFrame(() => {
    const g = geoRef.current;
    if (!g) return;
    const t = clock.current.t;
    const pos = g.attributes.position;
    const col = g.attributes.color;
    const a = pos.array;
    const c = col.array;
    for (let idx = 0; idx < a.length; idx += 3) {
      const x = a[idx];
      const z = a[idx + 2];
      const y =
        pattern === 'ripple'
          ? Math.sin(Math.hypot(x, z) * frequency - t * 1.6) * amplitude * (1 / (1 + 0.12 * Math.hypot(x, z)))
          : Math.sin(x * frequency + t) * Math.cos(z * frequency + t) * amplitude;
      a[idx + 1] = y;
      // Height to colour: -amplitude..+amplitude spread over the ramp.
      const h = amplitude > 0 ? Math.min(1, Math.max(0, 0.5 + 0.5 * (y / amplitude))) : 0.5;
      const s = h * (ramp.length - 1);
      const lo = Math.min(ramp.length - 2, Math.floor(s));
      tint.copy(ramp[lo]).lerp(ramp[lo + 1], s - lo);
      c[idx] = tint.r;
      c[idx + 1] = tint.g;
      c[idx + 2] = tint.b;
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial size={size} vertexColors transparent opacity={opacity} blending={AdditiveBlending} depthWrite={false} sizeAttenuation toneMapped={false} />
    </points>
  );
}
