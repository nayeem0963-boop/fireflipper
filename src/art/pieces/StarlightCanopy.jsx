import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color } from 'three';
import Glow from '../Glow.jsx';
import { galaxyPoints } from '../geometry/galaxy.js';
import { POINT_FRAGMENT, galaxyUniforms, galaxyVertex } from '../shaders/pointFields.js';
import { usePaletteColors } from '../usePalette.js';

const RADIUS = 4.4;
const BURST_PERIOD = 7;
const MAX_BURSTS = 6;

/**
 * Starlight Canopy: tens of thousands of stars in a spiral galaxy. The star positions are made once on the CPU
 * (geometry/galaxy.js); the turning (faster near the core, like a real galaxy), the twinkle and the colour all happen in the
 * vertex shader. Rings of light burst outwards from the core now and then. Fewer stars on the low quality tier.
 */
export default function StarlightCanopy({ params, palette, clock, quality }) {
  const { stars, arms, twist, spread, size, bursts } = params;
  const { colors } = usePaletteColors(palette);
  const pixel = useThree((s) => s.gl.getPixelRatio());
  const group = useRef();
  const rings = useRef([]);
  const count = quality === 'low' ? Math.min(stars, 15000) : stars;

  const geometry = useMemo(() => {
    const { positions, rands } = galaxyPoints({ count, arms, radius: RADIUS, twist, spread });
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(positions, 3));
    g.setAttribute('aRand', new BufferAttribute(rands, 1));
    return g;
  }, [count, arms, twist, spread]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(galaxyUniforms, []);
  useEffect(() => {
    uniforms.uColA.value.copy(colors[0]);
    uniforms.uColB.value.copy(colors[3]).lerp(colors[1], 0.35);
    uniforms.uColC.value.copy(colors[2]).lerp(new Color('#ffffff'), 0.5);
    uniforms.uRadius.value = RADIUS;
    uniforms.uPixel.value = pixel;
  }, [uniforms, colors, pixel]);

  useFrame(() => {
    const t = clock.current.t;
    uniforms.uTime.value = t;
    uniforms.uSize.value = size;
    uniforms.uAlpha.value = 0.9;
    if (group.current) group.current.rotation.x = 0.28 + Math.sin(t * 0.12) * 0.06;
    for (let k = 0; k < MAX_BURSTS; k++) {
      const s = rings.current[k];
      if (!s) continue;
      const phase = (t / BURST_PERIOD + k / Math.max(1, bursts)) % 1;
      const grow = 0.6 + phase * RADIUS * 2.3;
      s.scale.set(grow, grow, 1);
      s.material.opacity = Math.pow(1 - phase, 2.2) * 0.5;
    }
  });

  return (
    <group ref={group}>
      <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial uniforms={uniforms} vertexShader={galaxyVertex} fragmentShader={POINT_FRAGMENT} transparent depthWrite={false} blending={AdditiveBlending} />
      </points>
      <Glow color={palette.colors[2]} size={3.2} opacity={0.75} />
      <Glow color={palette.colors[0]} size={7} opacity={0.22} />
      {Array.from({ length: bursts }, (_, k) => (
        <Glow key={k} ref={(s) => (rings.current[k] = s)} color={palette.accent} size={1} opacity={0.3} />
      ))}
    </group>
  );
}
