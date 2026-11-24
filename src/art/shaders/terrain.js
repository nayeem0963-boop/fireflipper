import { Color, Vector3 } from 'three';
import { NOISE_GLSL } from './noise.js';

/**
 * The Monolith Grid's terrain: a flat plane pushed into hills by scrolling noise, with a ring of ripples spreading from
 * wherever the pointer touches it, and drawn as glowing grid lines (made in the fragment shader, so they stay one pixel
 * wide at any distance) that fade out towards the edge of the plane.
 */
export const terrainVertex = /* glsl */ `
uniform float uTime;
uniform float uHeight;
uniform float uRipple;
uniform float uScroll;
uniform vec3 uMouse;
varying vec2 vUv;
varying float vH;
varying float vRadial;
${NOISE_GLSL}

void main() {
  vUv = uv;
  vec2 xz = position.xy; // the plane is built in x/y and turned flat by the mesh
  float h = snoise(vec3(xz * 0.22 + vec2(0.0, uTime * uScroll), uTime * 0.05)) * 0.7
          + snoise(vec3(xz * 0.55 - vec2(uTime * uScroll * 0.6, 0.0), 3.0)) * 0.3;
  float d = distance(xz, uMouse.xz);
  float ring = sin(d * 5.0 - uTime * 4.0) * exp(-d * 0.5) * uRipple;
  float height = (h * uHeight + ring * 0.5);
  vH = height;
  vRadial = length(xz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, height, 1.0);
}
`;

export const terrainFragment = /* glsl */ `
uniform float uCells;
uniform float uGlow;
uniform float uEdge;
uniform vec3 uColA;
uniform vec3 uColB;
varying vec2 vUv;
varying float vH;
varying float vRadial;

void main() {
  vec2 coord = vUv * uCells;
  vec2 g = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  float fade = 1.0 - smoothstep(uEdge * 0.35, uEdge * 0.5, vRadial);
  vec3 col = mix(uColA, uColB, smoothstep(-0.4, 0.9, vH));
  float a = line * fade;
  gl_FragColor = vec4(col * (0.8 + uGlow * (0.6 + max(vH, 0.0) * 1.6)), a);
  #include <colorspace_fragment>
}
`;

export const terrainUniforms = () => ({
  uTime: { value: 0 },
  uHeight: { value: 0.7 },
  uRipple: { value: 0.8 },
  uScroll: { value: 0.35 },
  uMouse: { value: new Vector3(0, 0, 0) },
  uCells: { value: 44 },
  uGlow: { value: 1 },
  uEdge: { value: 14 },
  uColA: { value: new Color('#a3120a') },
  uColB: { value: new Color('#ffb347') },
});
