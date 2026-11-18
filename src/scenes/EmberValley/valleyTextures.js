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

/**
 * Sundarbans floor: tidal water in the foreground with lighter ripple streaks running along the flight direction,
 * and a brown mud bank (with a wobbling edge) at the far side. Tiles along x. The top of the image is the far side.
 */
export function createSundarbansGroundTexture(s) {
  const w = 256;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = s.water;
  ctx.fillRect(0, 0, w, h);
  // ripple streaks (seamless across x: each is drawn twice when it crosses the edge)
  ctx.strokeStyle = s.waterLight;
  ctx.lineCap = 'round';
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 46; i++) {
    const y = h * 0.38 + rnd() * h * 0.62;
    const x = rnd() * w;
    const len = 14 + rnd() * 40;
    ctx.globalAlpha = 0.18 + rnd() * 0.3;
    ctx.lineWidth = 1 + rnd() * 1.6;
    for (const dx of [0, -w, w]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, y);
      ctx.lineTo(x + dx + len, y + (rnd() - 0.5) * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  // far mud bank: top ~36% of the image, with a wavy shoreline that tiles
  const shore = (x) => h * 0.36 + Math.sin((x / w) * Math.PI * 6) * 7 + Math.sin((x / w) * Math.PI * 14 + 1) * 3;
  ctx.fillStyle = s.mud;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let x = 0; x <= w; x += 4) ctx.lineTo(x, shore(x));
  ctx.lineTo(w, 0);
  ctx.closePath();
  ctx.fill();
  // darker wet mud along the shoreline
  ctx.strokeStyle = s.mudDark;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 4) (x === 0 ? ctx.moveTo(x, shore(x) - 2) : ctx.lineTo(x, shore(x) - 2));
  ctx.stroke();
  ctx.globalAlpha = 1;
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
