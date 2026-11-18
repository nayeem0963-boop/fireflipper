import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

/** Procedural textures for Ember Valley. Created once per scene mount. */

/** Dark ground with faint glowing grid lines (tiles seamlessly). */
export function createGroundTexture(scene) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = scene.groundBase;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = `rgba(${scene.grid}, 0.55)`;
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, size, size);
  ctx.strokeStyle = `rgba(${scene.grid}, 0.15)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Vertical gradient for the lava-lit horizon sky. */
export function createSkyTexture(scene) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  [0, 0.45, 0.75, 0.9, 1].forEach((stop, i) => g.addColorStop(stop, scene.sky[i]));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}
