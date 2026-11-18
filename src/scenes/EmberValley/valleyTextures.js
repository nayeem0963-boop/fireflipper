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

/** Amazon forest floor: dark brown earth with scattered leaf litter and a few root lines. Tiles along x. */
export function createAmazonGroundTexture(s) {
  const w = 256;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = s.floor;
  ctx.fillRect(0, 0, w, h);
  let seed = 11;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  // leaf litter: small angular flecks, seamless across x
  for (let i = 0; i < 240; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const size = 2 + rnd() * 5;
    ctx.fillStyle = s.leafLitter[Math.floor(rnd() * s.leafLitter.length)];
    ctx.globalAlpha = 0.35 + rnd() * 0.4;
    for (const dx of [0, -w, w]) {
      ctx.save();
      ctx.translate(x + dx, y);
      ctx.rotate(rnd() * Math.PI);
      ctx.fillRect(-size, -size * 0.4, size * 2, size * 0.8);
      ctx.restore();
    }
  }
  // root lines running along the flight direction
  ctx.strokeStyle = s.floorDark;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const y = rnd() * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.3, y + (rnd() - 0.5) * 18, w * 0.7, y + (rnd() - 0.5) * 18, w, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/* -------------------------------------------------------------- Volcanic Coast floors */

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

/** The sea: a muted-jade low-poly surface with faint lighter streaks. Tiles in both directions (one tile = 4 world units). */
export function createCoastWaterTexture(s) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const rnd = seededRnd(5);
  facets(ctx, 0, 0, size, size, s.water, { cell: 64, jitter: 0.032, rnd });
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const y = rnd() * size;
    const x = rnd() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 40 + rnd() * 50, y + (rnd() - 0.5) * 3);
    ctx.stroke();
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/**
 * The shore: warm faceted sand on the far side of the floor with a jagged, darker wet edge, and the sea in front. Tiles along x;
 * one tile spans the whole depth of the floor, with the top of the image the far side.
 */
export function createCoastShoreTexture(s) {
  const w = 256;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const rnd = seededRnd(21);
  ctx.clearRect(0, 0, w, h);
  // the beach covers the far ~70% of the floor; the shoreline wanders gently (whole periods per tile, so it tiles)
  const shore = (x) => h * 0.7 + Math.sin((x / w) * Math.PI * 2) * 2 + Math.sin((x / w) * Math.PI * 6 + 1) * 1;
  // sand over the far side: facets clipped to the shoreline
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let x = 0; x <= w; x += 4) ctx.lineTo(x, shore(x));
  ctx.lineTo(w, 0);
  ctx.closePath();
  ctx.clip();
  facets(ctx, 0, 0, w, h, s.sand, { cell: 32, jitter: 0.09, rnd });
  // a few darker dune shadows
  ctx.fillStyle = s.sandDark;
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 7; i++) {
    const x = rnd() * w;
    const y = rnd() * h * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 40 + rnd() * 40, y + 6);
    ctx.lineTo(x + 20, y + 16 + rnd() * 10);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // wet edge
  ctx.strokeStyle = s.sandDark;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 4) (x === 0 ? ctx.moveTo(x, shore(x)) : ctx.lineTo(x, shore(x)));
  ctx.stroke();
  ctx.globalAlpha = 1;
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

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
