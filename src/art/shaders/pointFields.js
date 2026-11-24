import { Color } from 'three';

/**
 * Shaders for the particle pieces. Three vertex shaders share one soft round fragment shader:
 *  - emberVertex:    points orbiting a centre on tilted rings, all moved on the GPU from a per-point seed (Vortex Core)
 *  - galaxyVertex:   a spiral galaxy that turns faster near its core and twinkles (Starlight Canopy)
 *  - dynamicVertex:  plain points whose positions, colours and sizes the CPU updates each frame (Cyber Helix pulses)
 * Draw them with additive blending and no depth write.
 */
export const POINT_FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  float a = smoothstep(0.5, 0.0, r);
  gl_FragColor = vec4(vColor, pow(a, 1.4) * vAlpha);
  #include <colorspace_fragment>
}
`;

export const emberVertex = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform float uPixel;
uniform float uAlpha;
uniform vec3 uColA;
uniform vec3 uColB;
attribute vec4 aSeed; // radius, phase, speed, tilt
varying vec3 vColor;
varying float vAlpha;
void main() {
  float a = aSeed.y + uTime * aSeed.z;
  float r = aSeed.x * (1.0 + 0.06 * sin(uTime * 1.3 + aSeed.y * 5.0));
  vec3 p = vec3(cos(a) * r, 0.18 * r * sin(a * 2.0 + aSeed.y), sin(a) * r);
  float ct = cos(aSeed.w);
  float st = sin(aSeed.w);
  p = vec3(p.x, p.y * ct - p.z * st, p.y * st + p.z * ct);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(uSize * uPixel * (24.0 / -mv.z) * (0.6 + 0.8 * fract(aSeed.y * 7.31)), 96.0);
  vColor = mix(uColA, uColB, fract(aSeed.y * 3.7)) * 1.35;
  vAlpha = uAlpha * 1.9 * (0.65 + 0.35 * sin(uTime * 4.0 + aSeed.y * 30.0));
}
`;

export const galaxyVertex = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform float uPixel;
uniform float uAlpha;
uniform float uRadius;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColC;
attribute float aRand;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float r = length(position.xz);
  float a = uTime * 0.5 * 0.55 / (0.35 + r * 0.45); // inner stars turn faster than outer ones
  float c = cos(a);
  float s = sin(a);
  vec3 p = vec3(position.x * c - position.z * s, position.y, position.x * s + position.z * c);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float k = clamp(r / uRadius, 0.0, 1.0);
  vec3 col = k < 0.5 ? mix(uColC, uColA, k * 2.0) : mix(uColA, uColB, (k - 0.5) * 2.0);
  vColor = col * (0.7 + 0.6 * aRand);
  vAlpha = uAlpha * (0.65 + 0.35 * sin(uTime * 2.5 + aRand * 60.0)) * (1.0 - 0.5 * k);
  gl_PointSize = min(uSize * uPixel * (26.0 / -mv.z) * (0.5 + 1.2 * aRand * aRand), 64.0);
}
`;

export const dynamicVertex = /* glsl */ `
uniform float uPixel;
uniform float uAlpha;
attribute vec3 aColor;
attribute float aSize;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(aSize * uPixel * (60.0 / -mv.z), 160.0);
  vColor = aColor;
  vAlpha = uAlpha;
}
`;

const base = () => ({ uTime: { value: 0 }, uSize: { value: 1 }, uPixel: { value: 1 }, uAlpha: { value: 1 } });
export const emberUniforms = () => ({ ...base(), uColA: { value: new Color('#ff5a14') }, uColB: { value: new Color('#ffd36b') } });
export const galaxyUniforms = () => ({ ...base(), uRadius: { value: 4 }, uColA: { value: new Color('#ff5a14') }, uColB: { value: new Color('#ffd36b') }, uColC: { value: new Color('#ffffff') } });
export const dynamicUniforms = () => ({ uPixel: { value: 1 }, uAlpha: { value: 1 } });
