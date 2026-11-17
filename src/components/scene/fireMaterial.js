import { Color, MeshStandardMaterial } from 'three';

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
 */
export function createFireUniforms(palette, minY, maxY) {
  return {
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
      .replace('#include <common>', '#include <common>\nvarying float vFireH;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFireH = position.y;');
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
