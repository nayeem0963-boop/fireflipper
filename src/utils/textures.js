import { CanvasTexture, SRGBColorSpace } from 'three';

/**
 * Procedural textures generated once and shared. Generating them on a
 * canvas avoids shipping image files for simple glow effects.
 */
let glowTexture = null;

/** Soft radial gradient used for halos and ember particles. */
export function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,240,200,1)');
  g.addColorStop(0.2, 'rgba(255,190,90,0.85)');
  g.addColorStop(0.5, 'rgba(255,110,30,0.3)');
  g.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new CanvasTexture(canvas);
  glowTexture.colorSpace = SRGBColorSpace;
  return glowTexture;
}

let softTexture = null;

/** Soft white radial puff (alpha falls off to nothing): tinted per use, for ash clouds. */
export function getSoftTexture() {
  if (softTexture) return softTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  softTexture = new CanvasTexture(canvas);
  softTexture.colorSpace = SRGBColorSpace;
  return softTexture;
}
