import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BackSide, Color } from 'three';
import Glow from '../Glow.jsx';
import { coronaFragment, coronaUniforms, coronaVertex, plasmaFragment, plasmaUniforms, plasmaVertex } from '../shaders/plasma.js';
import { usePaletteColors } from '../usePalette.js';

/**
 * Plasma Sphere: a sun-like sphere. Its surface is displaced in the vertex shader by three octaves of animated noise (it
 * boils), and coloured in the fragment shader by a heat ramp (dark, the palette, then white-hot) with bright veins where a
 * second noise crosses zero. A back-face shell adds a fresnel corona, and a halo and a light spill glow on the scene.
 */
export default function PlasmaSphere({ params, palette, clock, quality }) {
  const { amplitude, scale, boil, core, corona } = params;
  const { colors, accent } = usePaletteColors(palette);
  const sphere = useRef();
  const shell = useRef();
  const light = useRef();
  const surface = useMemo(plasmaUniforms, []);
  const halo = useMemo(coronaUniforms, []);
  const low = quality === 'low';
  const white = useMemo(() => new Color('#ffffff'), []);

  useEffect(() => {
    surface.uColDark.value.copy(colors[3]);
    surface.uColA.value.copy(colors[0]);
    surface.uColB.value.copy(colors[1]);
    surface.uColHot.value.copy(colors[2]).lerp(white, 0.65);
    halo.uColor.value.copy(accent);
  }, [surface, halo, colors, accent, white]);

  useFrame(() => {
    const t = clock.current.t;
    surface.uTime.value = t;
    surface.uAmp.value = amplitude;
    surface.uScale.value = scale;
    surface.uBoil.value = boil;
    surface.uCore.value = core;
    halo.uIntensity.value = corona * 1.2;
    halo.uPower.value = 2.6;
    if (sphere.current) sphere.current.rotation.y = t * 0.08;
    if (shell.current) shell.current.scale.setScalar(1.3 * (1 + 0.02 * Math.sin(t * 1.6)));
    if (light.current) light.current.intensity = core * (22 + 6 * Math.sin(t * 1.3));
  });

  return (
    <group>
      <mesh ref={sphere}>
        <icosahedronGeometry args={[1, low ? 16 : 36]} />
        <shaderMaterial uniforms={surface} vertexShader={plasmaVertex} fragmentShader={plasmaFragment} />
      </mesh>
      <mesh ref={shell}>
        <sphereGeometry args={[1, 48, 32]} />
        <shaderMaterial uniforms={halo} vertexShader={coronaVertex} fragmentShader={coronaFragment} side={BackSide} transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      {corona > 0 && <Glow color={palette.colors[0]} size={6} opacity={0.3 * Math.min(corona, 1.5)} />}
      <pointLight ref={light} color={accent} distance={12} decay={1.5} />
    </group>
  );
}
