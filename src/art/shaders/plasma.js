import { Color } from 'three';
import { NOISE_GLSL } from './noise.js';

/**
 * The Plasma Sphere. A sphere whose surface boils: three octaves of animated noise push it in and out, and the same
 * noise (plus a ridged vein layer) picks its colour from a heat ramp (dark, then the palette, then white-hot). A second,
 * slightly larger back-face shell adds a fresnel corona.
 */
export const plasmaVertex = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uScale;
uniform float uBoil;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying float vHeat;
${NOISE_GLSL}

void main() {
  vec3 p = normalize(position);
  float t = uTime * uBoil;
  float n = snoise(p * uScale + vec3(t * 0.15, t * 0.10, t * 0.20)) * 0.5
          + snoise(p * uScale * 2.1 - vec3(t * 0.30, 0.0, t * 0.12)) * 0.25
          + snoise(p * uScale * 4.3 + vec3(0.0, t * 0.60, t * 0.25)) * 0.125;
  vHeat = n;
  vec3 displaced = p * (1.0 + n * uAmp);
  vObj = p;
  vec4 world = modelMatrix * vec4(displaced, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * p);
  vViewDir = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const plasmaFragment = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform float uBoil;
uniform float uCore;
uniform vec3 uColDark;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColHot;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying float vHeat;
${NOISE_GLSL}

void main() {
  float t = uTime * uBoil;
  // Hot veins: where a second noise crosses zero, the plasma is brightest.
  float vein = 1.0 - abs(snoise(vObj * uScale * 3.0 + vec3(0.0, t * 0.35, t * 0.2)));
  float heat = clamp(0.36 + vHeat * 1.0 + pow(vein, 6.0) * 0.5, 0.0, 1.0);

  vec3 col = heat < 0.35 ? mix(uColDark, uColA, heat / 0.35)
           : heat < 0.7  ? mix(uColA, uColB, (heat - 0.35) / 0.35)
                         : mix(uColB, uColHot, (heat - 0.7) / 0.3);
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(vViewDir);
  float facing = max(dot(N, V), 0.0);
  col *= (0.5 + 0.45 * facing) * uCore * 0.85;       // limb darkening, like a real star
  col += uColB * pow(1.0 - facing, 3.0) * 0.5; // a hot edge

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const coronaVertex = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vViewDir;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const coronaFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uPower;
varying vec3 vNormalW;
varying vec3 vViewDir;
void main() {
  // The shell is drawn back-face only, so its normal points away from the viewer: flip it.
  float facing = max(dot(-normalize(vNormalW), normalize(vViewDir)), 0.0);
  float glow = pow(facing, uPower) * uIntensity;
  gl_FragColor = vec4(uColor * glow, glow);
  #include <colorspace_fragment>
}
`;

export const plasmaUniforms = () => ({
  uTime: { value: 0 },
  uAmp: { value: 0.28 },
  uScale: { value: 1.4 },
  uBoil: { value: 1.2 },
  uCore: { value: 1 },
  uColDark: { value: new Color('#a3120a') },
  uColA: { value: new Color('#ff5a14') },
  uColB: { value: new Color('#ffb347') },
  uColHot: { value: new Color('#fff1c9') },
});
export const coronaUniforms = () => ({ uColor: { value: new Color('#ff7a2a') }, uIntensity: { value: 1 }, uPower: { value: 3 } });
