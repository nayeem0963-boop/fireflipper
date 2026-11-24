import { Color } from 'three';

/**
 * Shaders for the Particle Dancer. The figure is a cloud of points drawn by `dancerVertex` (with POINT_FRAGMENT from
 * pointFields.js): all of its motion is done on the GPU from the base pose, so the point positions never need rewriting.
 *  - the dance: the body sways, more the higher up it is (so the arms and head move most), and breathes
 *  - the skirt: points of the skirt flow outwards and up in waves, more towards the hem
 *  - shimmer: every point jitters a little on its own phase
 *  - colour: a four-stop ramp from the feet to the raised hand, with a twinkle per point
 * `moteVertex` draws the embers drifting upwards through the background.
 */
export const dancerVertex = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform float uPixel;
uniform float uAlpha;
uniform float uShimmer;
uniform float uSway;
uniform float uBright;
uniform float uMinY;
uniform float uMaxY;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
attribute float aRand;
attribute float aKind;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec3 p = position;
  float h = clamp((position.y - uMinY) / (uMaxY - uMinY), 0.0, 1.0);
  float t = uTime;

  // The dance: the upper body leans and sways more than the legs, and she breathes.
  float lean = uSway * h * h;
  p.x += sin(t * 0.9) * 0.10 * lean;
  p.z += sin(t * 0.7 + 1.3) * 0.08 * lean + cos(t * 0.5) * 0.05 * uSway * h;
  p.y += sin(t * 1.1 + h * 3.0) * 0.03 * uSway;

  // The skirt flows: points swell outwards and lift in waves that run round it, stronger towards the hem.
  if (aKind > 0.5) {
    vec2 radial = vec2(position.x - 0.08, position.z);
    float hem = clamp((1.95 - position.y) / 0.7, 0.0, 1.0);
    float ang = atan(radial.y, radial.x);
    p.xz += normalize(radial + vec2(1e-4)) * sin(t * 1.8 + ang * 4.0 + hem * 3.0) * 0.10 * hem * uSway;
    p.y += sin(t * 1.4 + ang * 3.0) * 0.06 * hem * uSway;
  }

  // Shimmer: each point jitters on its own phase.
  p += vec3(sin(t * 2.1 + aRand * 40.0), sin(t * 2.7 + aRand * 71.0), sin(t * 1.9 + aRand * 17.0)) * 0.022 * uShimmer;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  vec3 col = h < 0.33 ? mix(uC0, uC1, h / 0.33) : h < 0.66 ? mix(uC1, uC2, (h - 0.33) / 0.33) : mix(uC2, uC3, (h - 0.66) / 0.34);
  vColor = col * uBright * (0.8 + 0.5 * aRand);
  vAlpha = uAlpha * (0.7 + 0.3 * sin(t * 3.0 + aRand * 60.0)) * (aKind > 0.5 ? 0.6 : 1.0);
  gl_PointSize = min(uSize * uPixel * (18.0 / -mv.z) * (0.55 + 0.9 * aRand), 48.0);
}
`;

export const moteVertex = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform float uPixel;
uniform float uAlpha;
uniform float uTop;
uniform float uFloor;
uniform vec3 uColA;
uniform vec3 uColB;
attribute float aRand;
varying vec3 vColor;
varying float vAlpha;

void main() {
  // Rise slowly and wrap round from the top to the floor, drifting from side to side.
  float y = mod(position.y - uFloor + uTime * (0.12 + 0.25 * aRand), uTop - uFloor) + uFloor;
  vec3 p = vec3(position.x + sin(uTime * 0.3 + aRand * 20.0) * 0.25, y, position.z + cos(uTime * 0.25 + aRand * 33.0) * 0.25);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float life = (y - uFloor) / (uTop - uFloor);
  vColor = mix(uColA, uColB, aRand);
  vAlpha = uAlpha * sin(life * 3.14159) * (0.6 + 0.4 * sin(uTime * 3.0 + aRand * 50.0));
  gl_PointSize = min(uSize * uPixel * (20.0 / -mv.z) * (0.5 + aRand), 40.0);
}
`;

export const dancerUniforms = () => ({
  uTime: { value: 0 },
  uSize: { value: 1.4 },
  uPixel: { value: 1 },
  uAlpha: { value: 0.9 },
  uShimmer: { value: 1 },
  uSway: { value: 1 },
  uBright: { value: 1 },
  uMinY: { value: 0 },
  uMaxY: { value: 3.5 },
  uC0: { value: new Color('#2f6bff') },
  uC1: { value: new Color('#8a3dff') },
  uC2: { value: new Color('#ff3fd0') },
  uC3: { value: new Color('#ffc34a') },
});
export const moteUniforms = () => ({
  uTime: { value: 0 },
  uSize: { value: 1 },
  uPixel: { value: 1 },
  uAlpha: { value: 0.7 },
  uTop: { value: 6 },
  uFloor: { value: -1 },
  uColA: { value: new Color('#ffb347') },
  uColB: { value: new Color('#ffd36b') },
});
