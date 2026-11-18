import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, ShaderMaterial } from 'three';
import { envState, environmentAt } from '../../systems/world/environments.js';
import { envFx } from './envFx.js';

/**
 * The sky: one quad and a four-colour vertical gradient computed in the shader, so the colours can
 * blend continuously from one environment to the next without regenerating any texture. Same
 * layout as the old canvas gradient (dark at the top, glowing at the horizon).
 */
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uLow;
  uniform vec3 uHor;
  uniform float uFlash;
  varying vec2 vUv;
  void main() {
    float p = 1.0 - vUv.y;                       // 0 at the top of the quad, 1 at the horizon
    vec3 c = mix(uTop, uMid, smoothstep(0.0, 0.45, p));
    c = mix(c, uLow, smoothstep(0.45, 0.75, p));
    c = mix(c, uHor, smoothstep(0.75, 1.0, p));
    c += uFlash * vec3(0.34, 0.27, 0.23) * (1.0 - 0.5 * p);   // distant lightning in a storm
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

export default function Sky({ sim }) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new Color() },
          uMid: { value: new Color() },
          uLow: { value: new Color() },
          uHor: { value: new Color() },
          uFlash: { value: 0 },
        },
      }),
    [],
  );

  useFrame(() => {
    const e = environmentAt(sim.renderDistance(), envState);
    const u = material.uniforms;
    u.uTop.value.setRGB(...e.sky.top);
    u.uMid.value.setRGB(...e.sky.mid);
    u.uLow.value.setRGB(...e.sky.low);
    u.uHor.value.setRGB(...e.sky.hor);
    u.uFlash.value = envFx.flash;
  });

  return (
    <mesh position={[0, 8, -60]} material={material}>
      <planeGeometry args={[400, 60]} />
    </mesh>
  );
}
