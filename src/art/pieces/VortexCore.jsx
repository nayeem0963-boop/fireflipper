import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Float32BufferAttribute } from 'three';
import Glow from '../Glow.jsx';
import { torusGridLines } from '../geometry/torusGrid.js';
import { createRng } from '../noise.js';
import { POINT_FRAGMENT, emberUniforms, emberVertex } from '../shaders/pointFields.js';
import { usePaletteColors } from '../usePalette.js';

const MAX_EMBERS = 2000;
/** Three nested tori: scale, the axis each starts turned about, and how fast each one turns. */
const SHELLS = [
  { scale: 1, tilt: [0, 0, 0], spin: [0.18, 0.31, 0], color: 0 },
  { scale: 0.8, tilt: [Math.PI / 2, 0, 0], spin: [0.27, 0, 0.2], color: 1 },
  { scale: 0.6, tilt: [0, 0, Math.PI / 2], spin: [0, -0.34, 0.24], color: 3 },
];

/**
 * Vortex Core: three nested wireframe tori (drawn as clean grid lines) turning at different rates round a pulsing
 * energy orb, with a cloud of embers orbiting on tilted rings (moved entirely on the GPU from per-ember seeds).
 */
export default function VortexCore({ params, palette, clock, quality }) {
  const { shellSpeed, shellOpacity, pulse, embers, glow } = params;
  const { colors, accent } = usePaletteColors(palette);
  const pixel = useThree((s) => s.gl.getPixelRatio());
  const shells = useRef([]);
  const orb = useRef();
  const light = useRef();
  const low = quality === 'low';

  const grid = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(torusGridLines({ major: 2.5, minor: 0.62, rings: low ? 28 : 44, lines: low ? 10 : 16 }), 3));
    return g;
  }, [low]);
  useEffect(() => () => grid.dispose(), [grid]);

  // Every ember's orbit (radius, phase, speed, tilt), made once; the Embers slider just changes how many are drawn.
  const cloud = useMemo(() => {
    const rng = createRng(11);
    const seeds = new Float32Array(MAX_EMBERS * 4);
    for (let i = 0; i < MAX_EMBERS; i++) {
      seeds[i * 4] = 0.9 + Math.pow(rng(), 0.8) * 3.4;
      seeds[i * 4 + 1] = rng() * 6.2832;
      seeds[i * 4 + 2] = (0.25 + rng() * 0.9) * (rng() < 0.5 ? 1 : -1);
      seeds[i * 4 + 3] = (rng() - 0.5) * 2.4;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(MAX_EMBERS * 3), 3));
    g.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    return g;
  }, []);
  useEffect(() => () => cloud.dispose(), [cloud]);
  useEffect(() => {
    cloud.setDrawRange(0, Math.round(embers * (low ? 0.5 : 1)));
  }, [cloud, embers, low]);

  const uniforms = useMemo(emberUniforms, []);
  useEffect(() => {
    uniforms.uColA.value.copy(colors[0]);
    uniforms.uColB.value.copy(colors[2]);
    uniforms.uPixel.value = pixel;
  }, [uniforms, colors, pixel]);

  const orbColor = useMemo(() => new Color().copy(colors[2]).lerp(new Color('#ffffff'), 0.25), [colors]);

  useFrame(() => {
    const t = clock.current.t;
    uniforms.uTime.value = t;
    uniforms.uSize.value = 7;
    uniforms.uAlpha.value = Math.min(1, 0.35 + glow * 0.45);
    shells.current.forEach((g, i) => {
      if (!g) return;
      const s = SHELLS[i];
      g.rotation.set(s.tilt[0] + t * s.spin[0] * shellSpeed, s.tilt[1] + t * s.spin[1] * shellSpeed, s.tilt[2] + t * s.spin[2] * shellSpeed);
    });
    const beat = 1 + 0.14 * pulse * Math.sin(t * 2.4) + 0.05 * pulse * Math.sin(t * 5.3);
    if (orb.current) orb.current.scale.setScalar(0.75 * beat);
    if (light.current) light.current.intensity = glow * (28 + 22 * pulse * Math.sin(t * 2.4));
  });

  return (
    <group>
      {SHELLS.map((s, i) => (
        <group key={i} ref={(g) => (shells.current[i] = g)} scale={s.scale}>
          <lineSegments geometry={grid}>
            <lineBasicMaterial color={colors[s.color]} transparent opacity={shellOpacity} toneMapped={false} />
          </lineSegments>
        </group>
      ))}

      <mesh ref={orb}>
        <sphereGeometry args={[1, 40, 28]} />
        <meshBasicMaterial color={orbColor} toneMapped={false} />
      </mesh>
      <pointLight ref={light} color={accent} distance={14} decay={1.5} />
      {glow > 0 && (
        <>
          <Glow color={palette.colors[0]} size={4.4} opacity={0.55 * Math.min(glow, 1.4)} />
          <Glow color={palette.colors[2]} size={2.4} opacity={0.7 * Math.min(glow, 1.4)} />
        </>
      )}

      <points geometry={cloud} frustumCulled={false}>
        <shaderMaterial uniforms={uniforms} vertexShader={emberVertex} fragmentShader={POINT_FRAGMENT} transparent depthWrite={false} blending={AdditiveBlending} />
      </points>
    </group>
  );
}
