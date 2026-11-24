import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Object3D } from 'three';
import { fbm3 } from '../noise.js';
import { usePaletteColors } from '../usePalette.js';

/**
 * Fractal Lattice: an n x n x n matrix of cubes. Layered noise (fbm) flows through the grid over time; each cube's size,
 * height, spin and colour follow the noise at its place, so the whole lattice swells, shrinks, rises and turns in waves.
 * One instanced mesh, updated on the CPU each frame (a few hundred cubes).
 */
export default function FractalLattice({ params, palette, clock, quality }) {
  const { grid, spacing, noiseScale, amplitude, breath, twist, metalness, roughness } = params;
  const n = quality === 'low' ? Math.min(grid, 6) : grid;
  const count = n * n * n;
  const mesh = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const tint = useMemo(() => new Color(), []);
  const { colors } = usePaletteColors(palette);
  // A ramp low to high through the palette: darkest colour, then the main colours, then the lightest.
  const ramp = useMemo(() => [colors[3], colors[0], colors[1], colors[2]], [colors]);

  useEffect(() => () => mesh.current?.dispose?.(), []);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.current.t;
    const half = (n - 1) / 2;
    let i = 0;
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        for (let z = 0; z < n; z++) {
          const px = (x - half) * spacing;
          const py = (y - half) * spacing;
          const pz = (z - half) * spacing;
          const f = fbm3(px * noiseScale + t * 0.25, py * noiseScale + t * 0.18, pz * noiseScale - t * 0.22, 3); // about -1..1
          const k = Math.min(1, Math.max(0, 0.5 + 0.5 * f * 1.4));
          const swell = 1 + breath * 0.35 * Math.sin(t * 1.1 + (x + y + z) * 0.6);
          dummy.position.set(px, py + f * amplitude * spacing, pz);
          dummy.rotation.set(f * twist * 1.5 + t * 0.15 * twist, t * 0.2 * twist + k * twist, f * twist * 0.6);
          dummy.scale.setScalar(spacing * 0.62 * (0.3 + 0.85 * k) * swell);
          dummy.updateMatrix();
          m.setMatrixAt(i, dummy.matrix);
          // Colour from the ramp by noise value.
          const s = k * (ramp.length - 1);
          const a = Math.min(ramp.length - 2, Math.floor(s));
          m.setColorAt(i, tint.copy(ramp[a]).lerp(ramp[a + 1], s - a));
          i++;
        }
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh key={count} ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial metalness={metalness} roughness={roughness} envMapIntensity={1.25} />
    </instancedMesh>
  );
}
