import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color } from 'three';
import Glow from '../Glow.jsx';
import { diamondGeometry } from '../geometry/diamond.js';
import { usePaletteColors } from '../usePalette.js';

const BEAM_LENGTH = 7;
const MAX_RAYS = 24;

/**
 * Quantum Prism: a faceted gem (flat-shaded, with a high refractive index and dispersion, so it bends and splits the
 * light behind it) turning on two axes. A white beam enters from the left and leaves as a fan of colour (the palette's
 * colours, spread across the rays) that sways. On the low quality tier the gem uses plain transparency instead of
 * transmission, which costs an extra render pass.
 */
export default function QuantumPrism({ params, palette, clock, quality }) {
  const { facets, ior, dispersion, roughness, rays, beam } = params;
  const { colors, accent, light } = usePaletteColors(palette);
  const outer = useRef();
  const inner = useRef();
  const fan = useRef([]);
  const gem = useMemo(() => diamondGeometry({ facets }), [facets]);
  useEffect(() => () => gem.dispose(), [gem]);
  const low = quality === 'low';

  // The palette spread across the rays, darkest to lightest.
  const rayColors = useMemo(() => {
    const ramp = [colors[3], colors[0], colors[1], colors[2]];
    return Array.from({ length: MAX_RAYS }, (_, i) => {
      const s = (i / (MAX_RAYS - 1)) * (ramp.length - 1);
      const a = Math.min(ramp.length - 2, Math.floor(s));
      return new Color().copy(ramp[a]).lerp(ramp[a + 1], s - a);
    });
  }, [colors]);

  useFrame(() => {
    const t = clock.current.t;
    if (outer.current) outer.current.rotation.y = t * 0.45; // first axis: spin
    if (inner.current) {
      inner.current.rotation.x = 0.3 + Math.sin(t * 0.37) * 0.55; // second axis: nod...
      inner.current.rotation.z = t * 0.21; // ...and roll
    }
    const spread = 0.55 + 0.12 * Math.sin(t * 0.4);
    for (let i = 0; i < rays; i++) {
      const g = fan.current[i];
      if (!g) continue;
      const f = rays === 1 ? 0.5 : i / (rays - 1);
      g.rotation.z = (f - 0.5) * 2 * spread + Math.sin(t * 0.6 + i * 0.5) * 0.04;
      const m = g.children[0]?.material;
      if (m) m.opacity = beam * (0.38 + 0.22 * Math.sin(t * 1.4 + i * 0.9));
    }
  });

  return (
    <group>
      <group ref={outer}>
        <group ref={inner}>
          {/* A small light inside the gem: something for the glass to refract and the dispersion to split */}
          <mesh scale={0.34}>
            <icosahedronGeometry args={[1, 1]} />
            <meshBasicMaterial color={accent} toneMapped={false} />
          </mesh>
          <Glow color={palette.accent} size={1.8} opacity={0.8} />
          <mesh geometry={gem}>
            <meshPhysicalMaterial
              flatShading
              color="#ffffff"
              roughness={roughness}
              metalness={0}
              ior={ior}
              dispersion={dispersion}
              transmission={low ? 0 : 1}
              transparent={low}
              opacity={low ? 0.6 : 1}
              thickness={0.9}
              attenuationColor={accent}
              attenuationDistance={6}
              envMapIntensity={1.6}
            />
          </mesh>
        </group>
      </group>
      <Glow color={palette.light} size={3.2} opacity={0.25} />

      {/* The beam coming in, and the fan going out */}
      <mesh position={[-BEAM_LENGTH / 2 - 0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.05, BEAM_LENGTH, 8]} />
        <meshBasicMaterial color={light} transparent opacity={0.8 * Math.min(beam, 1.5)} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {Array.from({ length: rays }, (_, i) => (
        <group key={i} ref={(g) => (fan.current[i] = g)} position={[0.3, 0, 0]}>
          <mesh position={[BEAM_LENGTH / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.045, BEAM_LENGTH, 6]} />
            <meshBasicMaterial color={rayColors[Math.round((i / Math.max(1, rays - 1)) * (MAX_RAYS - 1))]} transparent opacity={0.4 * beam} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
