import { Color, MeshStandardMaterial, Vector2, Vector3 } from 'three';

/**
 * Turns a model's own material into a "fire" material. The texture still supplies the detail (feather edges,
 * shading, eyes), but its colour is replaced by a flame gradient that climbs the body: deep ember low down,
 * orange through the middle, bright gold-white along the top. The same gradient also drives an emissive glow.
 *
 * Done with a small shader patch on MeshStandardMaterial (three's onBeforeCompile) so it needs no extra
 * textures and works for any model: the gradient runs along the model's own vertical extent.
 *
 *   mix:       how much of the original colour is replaced by flame (0 = none, 1 = all)
 *   lumFloor:  the original plumage's brightness is raised to at least this, so black feathers still catch fire
 *   glowStrength: strength of the emissive glow
 *
 * Wing beats on a static model: the same patch can bend the wings. Every vertex further than `flap.start` from the
 * body's centre line is turned about an axis through the shoulder by `uFlap` radians, scaled up smoothly to the full
 * angle at `flap.full` (so the wing bends from the shoulder and the body stays put, with no seam to tear), and
 * mirrored on the two sides. Set `uniforms.uFlap.value` each frame. Without a `flap` config nothing moves.
 *
 * Head and tail: with a `bend` config, vertices further than `bend.start` from the shoulder along the body (towards the
 * head, or towards the tail) pitch about the shoulder by `uHeadPitch` / `uTailPitch`, again ramping up to `bend.full`
 * and leaving the wings alone. `bend.headSign` says which end of the model's z axis is the head. This is how a static
 * model nods its head and flexes its tail in time with the wings (see birdMotion.js).
 */
export function createFireUniforms(palette, minY, maxY, flap = null, bend = null) {
  return {
    uHeadPitch: { value: 0 },
    uTailPitch: { value: 0 },
    uHeadSign: { value: bend?.headSign ?? 1 },
    uBend: { value: new Vector2(bend?.start ?? 1e9, bend?.full ?? 1e9 + 1) },
    uFlap: { value: 0 },
    uHinge: { value: new Vector3(...(flap?.hinge ?? bend?.hinge ?? [0, 0, 0])) },
    uAxis: { value: new Vector3(...(flap?.axis ?? [0, 0, 1])).normalize() },
    uWing: { value: new Vector2(flap?.start ?? 1e9, flap?.full ?? 1e9 + 1) },
    uMinY: { value: minY },
    uMaxY: { value: maxY },
    uLow: { value: new Color(palette.low) },
    uMid: { value: new Color(palette.mid) },
    uHigh: { value: new Color(palette.high) },
    uMix: { value: palette.mix },
    uGlow: { value: palette.glowStrength },
    uLumFloor: { value: palette.lumFloor },
  };
}

/** Builds a fire material from a loaded material, sharing `uniforms` with the other materials of the same bird. */
export function createFireMaterial(source, uniforms, cacheKey) {
  const material = new MeshStandardMaterial({
    map: source.map ?? null,
    side: source.side,
    roughness: 0.6,
    metalness: 0,
    alphaTest: source.alphaTest ?? 0,
    transparent: source.transparent ?? false,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying float vFireH;
uniform float uFlap;
uniform vec3 uHinge;
uniform vec3 uAxis;
uniform vec2 uWing;
uniform float uHeadPitch;
uniform float uTailPitch;
uniform float uHeadSign;
uniform vec2 uBend;
vec3 flapRotate(vec3 v, float a) {
  return v * cos(a) + cross(uAxis, v) * sin(a) + uAxis * dot(uAxis, v) * (1.0 - cos(a));
}
// Pitch in the plane of the body (forward = along z towards the head) and up: positive lifts the head end.
vec3 bendRotate(vec3 v, float phi) {
  float f = v.z * uHeadSign;
  float c = cos(phi);
  float s = sin(phi);
  return vec3(v.x, f * s + v.y * c, (f * c - v.y * s) * uHeadSign);
}`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
float flapDx = position.x - uHinge.x;
float flapAngle = uFlap * sign(flapDx) * smoothstep(uWing.x, uWing.y, abs(flapDx));
objectNormal = flapRotate(objectNormal, flapAngle);
float bendAlong = (position.z - uHinge.z) * uHeadSign;
float bendPhi = (uHeadPitch * smoothstep(uBend.x, uBend.y, bendAlong) + uTailPitch * smoothstep(uBend.x, uBend.y, -bendAlong))
  * (1.0 - smoothstep(uWing.x, uWing.y, abs(flapDx)));
objectNormal = bendRotate(objectNormal, bendPhi);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
transformed = uHinge + bendRotate(flapRotate(transformed - uHinge, flapAngle), bendPhi);
vFireH = position.y;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying float vFireH;
uniform float uMinY;
uniform float uMaxY;
uniform vec3 uLow;
uniform vec3 uMid;
uniform vec3 uHigh;
uniform float uMix;
uniform float uGlow;
uniform float uLumFloor;
vec3 fireGradient(float h) {
  return h < 0.5 ? mix(uLow, uMid, h * 2.0) : mix(uMid, uHigh, (h - 0.5) * 2.0);
}`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
float fireLum = max(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), uLumFloor);
float fireH = clamp((vFireH - uMinY) / max(uMaxY - uMinY, 0.0001), 0.0, 1.0);
vec3 fireColor = fireGradient(fireH);
diffuseColor.rgb = mix(diffuseColor.rgb, fireColor * min(0.35 + fireLum * 1.1, 1.0), uMix);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += fireColor * uGlow * (0.25 + fireLum);`,
      );
  };
  // All fire materials share one patched program; the uniforms carry the per-bird values.
  material.customProgramCacheKey = () => `fire-${cacheKey}`;
  return material;
}
