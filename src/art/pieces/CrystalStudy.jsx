import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color } from 'three';
import { iridescentFragment, iridescentUniforms, iridescentVertex } from '../shaders/iridescentBlob.js';

/**
 * Shader and material study. The sphere uses a hand-written ShaderMaterial (shaders/iridescentBlob.js); the rings
 * use MeshPhysicalMaterial with transmission and iridescence. On the low quality tier transmission is swapped for
 * plain transparency, because it costs an extra render pass.
 */
export default function CrystalStudy({ params, palette, clock, quality }) {
  const { amplitude, frequency, rim, iridescence, glass, ior, thickness, glassRoughness } = params;
  const uniforms = useMemo(iridescentUniforms, []);
  const rings = useRef();
  const low = quality === 'low';
  const accent = useMemo(() => new Color(palette.accent), [palette]);

  useEffect(() => {
    uniforms.uColA.value.set(palette.colors[3]);
    uniforms.uColB.value.set(palette.colors[0]);
    uniforms.uColC.value.set(palette.colors[2]);
  }, [uniforms, palette]);

  useFrame(() => {
    const t = clock.current.t;
    uniforms.uTime.value = t;
    uniforms.uAmp.value = amplitude;
    uniforms.uFreq.value = frequency;
    uniforms.uRim.value = rim;
    uniforms.uIridescence.value = iridescence;
    if (rings.current) {
      rings.current.rotation.y = t * 0.3;
      rings.current.rotation.x = Math.sin(t * 0.25) * 0.4;
    }
  });

  const ringMaterial = (
    <meshPhysicalMaterial
      color="#ffffff"
      metalness={0}
      roughness={glassRoughness}
      transmission={low ? 0 : 1}
      transparent={low}
      opacity={low ? 0.4 : 1}
      thickness={thickness}
      ior={ior}
      iridescence={1}
      iridescenceIOR={1.3}
      iridescenceThicknessMinimum={200}
      iridescenceThicknessMaximum={700}
      attenuationColor={accent}
      attenuationDistance={1.6}
      envMapIntensity={1.4}
    />
  );
  return (
    <group>
      <mesh>
        <icosahedronGeometry args={[1, low ? 12 : 24]} />
        <shaderMaterial uniforms={uniforms} vertexShader={iridescentVertex} fragmentShader={iridescentFragment} />
      </mesh>
      {glass && (
        <group ref={rings}>
          <mesh>
            <torusGeometry args={[1.75, 0.15, 40, 160]} />
            {ringMaterial}
          </mesh>
          <mesh rotation={[Math.PI / 2, 0.5, 0]}>
            <torusGeometry args={[1.95, 0.1, 40, 160]} />
            {ringMaterial}
          </mesh>
        </group>
      )}
    </group>
  );
}
