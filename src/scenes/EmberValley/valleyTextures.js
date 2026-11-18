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

/* -------------------------------------------------------------- Painted-zone floors */

/** Colours as [r, g, b] from a hex string, and back, for shading triangles. */
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const shade = ([r, g, b], k) => `rgb(${Math.round(Math.min(255, r * k))},${Math.round(Math.min(255, g * k))},${Math.round(Math.min(255, b * k))})`;

/**
 * Fills a rectangle of the canvas with flat-shaded low-poly facets: a grid of cells, each split into two triangles whose
 * brightness differs a little, so it reads as a faceted surface like the paintings' sea and dunes.
 */
function facets(ctx, x0, y0, x1, y1, base, { cell = 40, jitter = 0.06, rnd }) {
  const c = rgb(base);
  ctx.fillStyle = shade(c, 1);
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0); // under-paint, so the anti-aliased seams between triangles never show through
  for (let y = y0; y < y1; y += cell) {
    for (let x = x0; x < x1; x += cell) {
      const x2 = Math.min(x + cell, x1);
      const y2 = Math.min(y + cell, y1);
      const flip = rnd() > 0.5;
      const tris = flip
        ? [[[x, y], [x2, y], [x, y2]], [[x2, y], [x2, y2], [x, y2]]]
        : [[[x, y], [x2, y], [x2, y2]], [[x, y], [x2, y2], [x, y2]]];
      for (const tri of tris) {
        const col = shade(c, 1 + (rnd() - 0.5) * 2 * jitter);
        ctx.fillStyle = col;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tri[0][0], tri[0][1]);
        ctx.lineTo(tri[1][0], tri[1][1]);
        ctx.lineTo(tri[2][0], tri[2][1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // a hairline in the same colour closes the gap between neighbouring triangles
      }
    }
  }
}
const seededRnd = (seed) => {
  let v = seed;
  return () => ((v = (v * 9301 + 49297) % 233280) / 233280);
};

/**
 * The Arctic snowfield: faceted white-blue snow with soft pale-blue shadow facets and a few lighter ridges, like the paintings' low-poly
 * drifts. Tiles in both directions (one tile = 4 world units).
 */
export function createSnowTexture(s) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const rnd = seededRnd(33);
  facets(ctx, 0, 0, size, size, s.snow, { cell: 64, jitter: 0.035, rnd });
  // long soft shadow facets in the drift blue
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = s.snowShadow;
  for (let i = 0; i < 5; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 60 + rnd() * 50, y + 10 + rnd() * 20);
    ctx.lineTo(x + 20 + rnd() * 30, y + 40 + rnd() * 30);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 50 + rnd() * 40, y + 6);
    ctx.lineTo(x + 30, y + 22 + rnd() * 14);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/**
 * The Celestial Realm's floor: a deep blue-violet cloud sea with soft pastel mist and scattered stars. Tiles in both directions
 * (one tile = 4 world units). The stars give it a glittering, starlit-water look as it scrolls past.
 */
export function createStarSeaTexture(s) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const rnd = seededRnd(57);
  ctx.fillStyle = s.floor;
  ctx.fillRect(0, 0, size, size);
  // soft mist blotches (drawn at every wrap offset so the tile is seamless)
  for (let i = 0; i < 9; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 40 + rnd() * 70;
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        g.addColorStop(0, i % 3 === 0 ? 'rgba(150,110,210,0.30)' : 'rgba(90,120,200,0.28)');
        g.addColorStop(1, 'rgba(60,70,150,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    }
  }
  // stars: mostly tiny, a few with a glow
  for (let i = 0; i < 70; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const big = rnd() > 0.88;
    ctx.fillStyle = s.stars[Math.floor(rnd() * s.stars.length)];
    ctx.globalAlpha = 0.55 + rnd() * 0.45;
    ctx.beginPath();
    ctx.arc(x, y, big ? 2.2 : 1, 0, Math.PI * 2);
    ctx.fill();
    if (big) {
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/**
 * The Rose Sky Palace's floor: a mirror-still lavender-pink pool with soft glowing reflections of the palaces' golden lights, long pale
 * vertical streaks and a few ripples. Tiles in both directions (one tile = 4 world units).
 */
export function createPalacePoolTexture(s) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const rnd = seededRnd(71);
  // a flat base with soft darker and lighter blotches drawn at every wrap offset, so the tile has no visible seam
  ctx.fillStyle = s.pool;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 10; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 50 + rnd() * 70;
    const light = i % 2 === 0;
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        g.addColorStop(0, light ? 'rgba(255,214,228,0.35)' : 'rgba(120,80,140,0.28)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    }
  }
  // long pale reflection streaks (seamless across both edges)
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 9; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const w = 3 + rnd() * 8;
    const h = 40 + rnd() * 90;
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) ctx.fillRect(x + dx, y + dy, w, h);
  }
  // golden lantern glints
  for (let i = 0; i < 26; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    ctx.globalAlpha = 0.5 + rnd() * 0.4;
    ctx.fillStyle = s.glow;
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      ctx.beginPath();
      ctx.ellipse(x + dx, y + dy, 5 + rnd() * 4, 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/**
 * The Cloud Sanctuary's floor: a soft cloud sea of lavender and cream billows with golden glints, seamless on both axes (one tile = 4 world units).
 */
export function createCloudSeaTexture(s) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const rnd = seededRnd(91);
  ctx.fillStyle = s.cloud;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 16; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 40 + rnd() * 70;
    const light = i % 3 !== 0;
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        g.addColorStop(0, light ? 'rgba(255,246,230,0.55)' : 'rgba(150,130,190,0.35)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    }
  }
  ctx.fillStyle = s.glow;
  for (let i = 0; i < 20; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    ctx.globalAlpha = 0.35 + rnd() * 0.4;
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      ctx.beginPath();
      ctx.ellipse(x + dx, y + dy, 5 + rnd() * 5, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/**
 * The Red Rock Canyon's floor: dusty faceted red-orange earth with darker strata streaks and lighter sunlit patches, like the paintings' canyon
 * bed. Tiles in both directions (one tile = 4 world units).
 */
export function createCanyonFloorTexture(s) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const rnd = seededRnd(91);
  facets(ctx, 0, 0, size, size, s.floor, { cell: 64, jitter: 0.07, rnd });
  // lighter sunlit and darker shadowed patches (drawn at every wrap offset so the tile is seamless)
  for (let i = 0; i < 9; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 40 + rnd() * 60;
    const light = i % 2 === 0;
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        g.addColorStop(0, light ? 'rgba(255,170,110,0.28)' : 'rgba(60,15,5,0.30)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    }
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
