import { Color } from 'three';
import { NOISE_GLSL } from './noise.js';

/**
 * A shader study: a sphere whose surface is pushed about by two octaves of animated noise, lit only by what the
 * shader itself computes: a fresnel rim glow, and a thin-film style iridescence that shifts hue with the viewing
 * angle and with the displacement. No lights or textures are needed. Uniforms are listed in `iridescentUniforms`.
 */
export const iridescentVertex = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying float vDisp;
${NOISE_GLSL}

float displacement(vec3 p) {
  float n = snoise(p * uFreq + vec3(0.0, uTime * 0.5, uTime * 0.3));
  float n2 = snoise(p * uFreq * 2.3 - vec3(uTime * 0.4, 0.0, uTime * 0.2));
  return n * uAmp + n2 * uAmp * 0.3;
}
vec3 displaced(vec3 p) {
  return p + normalize(p) * displacement(p);
}

void main() {
  vec3 n = normalize(position);
  // The surface normal after the push: from two nearby points on the sphere.
  vec3 t = normalize(cross(n, abs(n.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
  vec3 b = cross(n, t);
  float e = 0.02;
  vec3 p0 = displaced(position);
  vec3 p1 = displaced(normalize(position + t * e) * length(position));
  vec3 p2 = displaced(normalize(position + b * e) * length(position));
  vec3 nn = normalize(cross(p1 - p0, p2 - p0));
  if (dot(nn, n) < 0.0) nn = -nn;

  vDisp = displacement(position);
  vec4 world = modelMatrix * vec4(p0, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * nn);
  vViewDir = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const iridescentFragment = /* glsl */ `
uniform float uTime;
uniform float uRim;
uniform float uIridescence;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColC;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying float vDisp;

void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(vViewDir);
  float facing = max(dot(N, V), 0.0);
  float fresnel = pow(1.0 - facing, uRim);

  // Thin-film iridescence: a cosine palette indexed by view angle, displacement and slow time.
  float hue = facing * 1.4 + vDisp * 2.5 + uTime * 0.04;
  vec3 film = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + hue));
  film = mix(film, uColB, 0.5);   // keep the film in the palette's family, not a rainbow of pastels

  vec3 base = mix(uColA, uColB, smoothstep(-0.25, 0.25, vDisp));
  vec3 color = mix(base, film, uIridescence * (0.12 + fresnel * 1.1));
  color *= 0.35 + 0.65 * facing;    // darker towards the edge, so the rim glow below stands out
  color += uColC * fresnel * 1.6;   // rim glow

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Fresh uniform objects (three updates them in place). */
export function iridescentUniforms() {
  return {
    uTime: { value: 0 },
    uAmp: { value: 0.28 },
    uFreq: { value: 1.1 },
    uRim: { value: 2.5 },
    uIridescence: { value: 0.8 },
    uColA: { value: new Color('#ff5a14') },
    uColB: { value: new Color('#ffb347') },
    uColC: { value: new Color('#ffd36b') },
  };
}
