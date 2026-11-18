import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, Color, Object3D, SRGBColorSpace, TextureLoader } from 'three';
import { WORLD } from '../../systems/physics/constants.js';
import { CROSSFADE, zoneWeight } from '../../systems/world/biomes.js';
import { DEPTH_SLIDE, layerSlack, loopOffset, paintingSlide, paintingSpan, slideWidth } from '../../systems/world/scrollDriver.js';

/**
 * Parts shared by the painted scenery zones (Volcanic Coast, Arctic Ice Shelf): the per-frame zone weight, a gradient sky, the
 * painted horizon bands, and a layer of low scenery that scrolls with parallax. All purely visual.
 */

/**
 * Where a painted horizon band stands: just in front of the base scenery's opaque sky plane (z = -60), so it is not hidden by it, and
 * with its bottom edge on the floor's horizon (the floor, drawn over it, covers the last few pixels).
 */
export const BAND_Z = -59;

export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Deterministic pseudo-random so layouts are stable across renders. */
export function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * Soft alpha masks (grey canvas, used as an alphaMap) that cut a depth layer out of a painting: `mid` keeps the side cliffs (outer
 * ~30% each side, fading towards the centre and the top), `near` keeps the outer ~14% and only the lower part of the picture.
 */
function createDepthMask(kind) {
  const w = 128, h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1), v = y / (h - 1);
      const edge = Math.min(u, 1 - u);
      const a = kind === 'mid' ? smooth(0.3, 0.1, edge) * smooth(0.06, 0.3, v) : smooth(0.15, 0.04, edge) * smooth(0.4, 0.62, v);
      const g = Math.round(255 * a);
      const k = (y * w + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = g;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return new CanvasTexture(c);
}

/** Computes the zone's weight once per frame for every part, and hides the whole group once it is gone. */
export function WeightDriver({ sim, zone, wRef, groupRef }) {
  useFrame(() => {
    const w = zoneWeight(zone, sim.renderDistance());
    wRef.current = w;
    if (groupRef.current) groupRef.current.visible = w > 0.001;
  }, -1);
  return null;
}

/** A tall plane behind everything, a vertical gradient of the zone's sky colours, fading in with the zone. */
export function GradientSky({ wRef, top, bottom }) {
  const mat = useRef();
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top);
    g.addColorStop(0.55, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [top, bottom]);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame(() => {
    if (mat.current) mat.current.opacity = Math.min(1, wRef.current * 1.6);
  });
  return (
    <mesh position={[0, 30, -58]} renderOrder={-3}>
      <planeGeometry args={[400, 130]} />
      <meshBasicMaterial ref={mat} map={tex} transparent fog={false} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

/**
 * Painted horizon bands as unlit billboards behind everything. Each painting is cropped to its sky-and-horizon band (so has its own
 * aspect), sized from the camera every frame so it always covers the view (and stays a sensible size on a tall phone screen), slides
 * sideways with the run distance (scrollDriver.js), and dissolves in over the one before at the given distances. Each painting loads when the player gets
 * within `preloadAt` metres (or its own `loadAt`), so the first screens of the game never wait for later paintings; a painting that fails to load is simply skipped.
 *
 * Props: zone, paintings [{ file, aspect }], cuts (metres where painting i+1 dissolves in), dissolve (metres), preloadAt, fadeRgb ([r, g, b] of the sky colour at the top of every painting, used to melt its top edge into the sky).
 *
 * A painting may set `horizon` (the row, as a fraction from its top, that sits on the horizon line) to hold still instead of sliding. `rise.cover` (default 1.5)
 * is how many times taller than the visible window the picture is scaled.
 *
 * `rise` switches to "sky" mode for a painting that is a whole scene rather than a horizon band (the Celestial Realm): the picture is scaled to
 * cover the view and slides down as you fly, from `rise.from` to `rise.to` (the fraction of the picture, from its top, that sits on the horizon),
 * so the view climbs from the floating cities up into the cosmos. No top fade is needed there.
 */
export function PaintedHorizon({ sim, wRef, zone, paintings, cuts, dissolve = 30, preloadAt, fadeRgb, rise, depth = false }) {
  const meshes = useRef([]);
  const mats = useRef([]);
  const fades = useRef([]);
  const fadeMats = useRef([]);
  const state = useRef({ requested: [], textures: [] });
  // depth layers (mid, near): extra planes sharing the painting's texture through a soft mask; mid-layer slides slower than near, both slower than the 3D layers
  const layerMeshes = useRef([]);
  const layerMats = useRef([]);
  const masks = useMemo(() => (depth ? { mid: createDepthMask('mid'), near: createDepthMask('near') } : null), [depth]);
  useEffect(() => () => { masks?.mid.dispose(); masks?.near.dispose(); }, [masks]);
  const fadeTex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    const [r, gg, b] = fadeRgb;
    g.addColorStop(0, `rgba(${r},${gg},${b},1)`);
    g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 64);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [fadeRgb]);
  useEffect(() => {
    const own = state.current;
    return () => {
      fadeTex.dispose();
      own.textures.forEach((t) => t?.dispose());
    };
  }, [fadeTex]);

  const load = (i) => {
    state.current.requested[i] = true;
    const loader = new TextureLoader();
    const base = import.meta.env?.BASE_URL ?? '/';
    loader.load(
      `${base}images/backdrop/${paintings[i].file}`,
      (tex) => {
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = 4;
        state.current.textures[i] = tex;
        const m = mats.current[i];
        if (m) {
          m.map = tex;
          m.needsUpdate = true;
        }
        layerMats.current[i]?.forEach((lm) => {
          if (lm) {
            lm.map = tex;
            lm.needsUpdate = true;
          }
        });
      },
      undefined,
      () => {}, // a missing painting just leaves the gradient sky and the 3D floor
    );
  };

  const refAspect = Math.min(...paintings.map((p) => p.aspect));
  useFrame((frame) => {
    const d = sim.renderDistance();
    // each painting loads when the player gets within its own distance (`loadAt`, else the zone's `preloadAt`), so none waits at start-up unless it is the first
    for (let i = 0; i < paintings.length; i++) if (!state.current.requested[i] && d > (paintings[i].loadAt ?? preloadAt)) load(i);
    const w = wRef.current;
    if (w <= 0.001) return;
    const cam = frame.camera;
    const fov = (cam.fov * Math.PI) / 180;
    const dist = cam.position.z - BAND_Z;
    const viewH = 2 * dist * Math.tan(fov / 2);
    const viewW = viewH * cam.aspect;
    // Large enough to cover the view and reach the sky, but on a tall (portrait) screen no more than ~2.6 views wide, so the scenery stays in frame.
    const needH = cam.position.y - WORLD.groundY + viewH * 0.58;
    // Sky mode: cover the view both ways (at least 1.5x the visible height, so there is room to slide); band mode as before.
    // Wide enough to cover the view and, in addition, to slide across the whole of its stretch at no less than the far-layer speed (see scrollDriver.js).
    const longest = Math.max(...paintings.map((_, i) => { const [a, b] = paintingSpan(zone, cuts, dissolve, i, paintings.length, CROSSFADE); return b - a; }));
    const W = rise
      ? Math.max(slideWidth(viewW, longest, depth ? DEPTH_SLIDE.near : undefined), needH * (rise.cover ?? 1.5) * refAspect)
      : Math.max(slideWidth(viewW, longest, depth ? DEPTH_SLIDE.near : undefined), Math.min(needH * refAspect, viewW * 2.6));
    const slack = (W - viewW) / 2;
    paintings.forEach(({ aspect, horizon }, i) => {
      const alpha = i === 0 ? w : w * smooth(cuts[i - 1] - dissolve / 2, cuts[i - 1] + dissolve / 2, d);
      const m = meshes.current[i];
      const f = fades.current[i];
      const ready = !!mats.current[i]?.map;
      const show = ready && alpha > 0.002;
      if (m) m.visible = show;
      if (f) f.visible = show;
      if (!show) layerMeshes.current[i]?.forEach((lm) => lm && (lm.visible = false));
      if (!show) return;
      // distance-driven slide across this painting's own stretch of the run (no wall clock, no per-frame accumulation)
      const [a, b] = paintingSpan(zone, cuts, dissolve, i, paintings.length, CROSSFADE);
      const x = cam.position.x + paintingSlide(d, a, b, depth ? layerSlack(slack, 'far') : slack);
      const H = W / aspect;
      let y = WORLD.groundY + H / 2 - 0.05;
      if (rise) {
        // the row v of the picture on the horizon slides from rise.from to rise.to, kept inside the picture so no edge ever shows
        const t = smooth(0, 1, (d - zone.start) / (zone.end - zone.start));
        const vMin = Math.min(0.99, needH / H);
        const v = clamp(horizon ?? rise.from + (rise.to - rise.from) * t, vMin, 1);
        y = WORLD.groundY + H * (v - 0.5);
      }
      m.position.set(x, y, BAND_Z);
      m.scale.set(W, H, 1);
      mats.current[i].opacity = Math.min(1, alpha * 1.5);
      if (depth) {
        layerMeshes.current[i]?.forEach((lm, k) => {
          if (!lm) return;
          lm.visible = true;
          lm.position.set(cam.position.x + paintingSlide(d, a, b, layerSlack(slack, k === 0 ? 'mid' : 'near')), y, BAND_Z + 0.002 * (k + 1));
          lm.scale.set(W, H, 1);
          layerMats.current[i][k].opacity = Math.min(1, alpha * 1.5);
        });
      }
      if (rise) {
        f.visible = false;
      } else {
        f.position.set(x, WORLD.groundY + H * 0.91, BAND_Z + 0.01);
        f.scale.set(W, H * 0.18, 1);
        fadeMats.current[i].opacity = Math.min(1, alpha * 1.5);
      }
    });
  });

  return (
    <>
      {paintings.map(({ file }, i) => (
        <group key={file}>
          <mesh ref={(m) => (meshes.current[i] = m)} renderOrder={-2} visible={false}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial ref={(m) => (mats.current[i] = m)} transparent opacity={0} depthWrite={false} fog={false} toneMapped={false} />
          </mesh>
          {depth &&
            ['mid', 'near'].map((kind, k) => (
              <mesh key={kind} ref={(m) => ((layerMeshes.current[i] ??= [])[k] = m)} renderOrder={-1.6 + k * 0.1} visible={false}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial ref={(m) => ((layerMats.current[i] ??= [])[k] = m)} alphaMap={masks[kind]} transparent opacity={0} depthWrite={false} fog={false} toneMapped={false} />
              </mesh>
            ))}
          <mesh ref={(m) => (fades.current[i] = m)} renderOrder={-1} visible={false}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial ref={(m) => (fadeMats.current[i] = m)} map={fadeTex} transparent opacity={0} depthWrite={false} fog={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/**
 * A layer of low scenery behind the flight plane (boulder islands, rock outcrops, tents...): one instanced mesh of the given geometry,
 * scrolling at its own parallax speed, growing from nothing as the zone fades in. `yScale` squashes it (flat outcrops).
 */
export function ParallaxLayer({ sim, wRef, geometry, depth, scale, count, span, speedFactor, seed, tint, yScale = 1, lift = [0, 0], emissive, emissiveIntensity = 0.4, growAll = false, bob = 0 }) {
  const mesh = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const items = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: count }, (_, i) => ({
      x: (i / count) * span - span / 2 + rand() * (span / count) * 0.7,
      s: scale * (0.6 + rand() * 0.8),
      dz: (rand() - 0.5) * 3,
      rot: rand() * Math.PI * 2,
      shade: 0.85 + rand() * 0.25,
      y: lift[0] + rand() * (lift[1] - lift[0]),
      phase: rand() * Math.PI * 2,
    }));
  }, [count, scale, seed, span, lift]);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const base = new Color(tint);
    const c = new Color();
    items.forEach((it, i) => m.setColorAt(i, c.copy(base).multiplyScalar(it.shade)));
    m.instanceColor.needsUpdate = true;
  }, [items, tint]);
  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const grow = Math.max(0.0001, wRef.current);
    const camX = state.camera.position.x;
    const offset = loopOffset(sim.renderDistance(), speedFactor, span);
    items.forEach((it, i) => {
      let x = it.x - offset;
      if (x < -span / 2) x += span;
      const floatY = bob ? Math.sin(state.clock.elapsedTime * 0.6 + it.phase) * bob : 0;
      dummy.position.set(x + camX, WORLD.groundY + it.y + floatY, it.dz);
      dummy.rotation.set(0, it.rot, 0);
      if (growAll) dummy.scale.setScalar(it.s * grow);
      else dummy.scale.set(it.s, it.s * yScale * grow, it.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <group position={[0, 0, depth]}>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial vertexColors flatShading roughness={1} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? emissiveIntensity : 0} />
      </instancedMesh>
    </group>
  );
}
