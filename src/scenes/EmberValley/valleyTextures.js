import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

/** Procedural textures for the journey. Created once per scene mount. (The sky is a shader now: see Sky.jsx.) */

/** Dark ground with faint glowing grid lines (tiles seamlessly). */
export function createGroundTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#140a06';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255, 120, 40, 0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255, 120, 40, 0.15)';
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
