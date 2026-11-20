import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, Object3D, SRGBColorSpace } from 'three';
import { BIOME_HAZARDS, HAZARDS, windowsIn } from '../../systems/hazards/biomeHazards.js';
import { BAND_BOTTOM, BAND_HEIGHT, BAND_Z, FAR_GLOW, KIND_STYLE, MAX_RAILS, MAX_WINDOWS, PARTICLES, particleAt, railFor, windowGlow } from '../../systems/hazards/telegraph.js';

/**
 * The telegraphs of the biome hazards, drawn with three meshes at most (three draw calls, each hidden when it has nothing to show):
 *  - the WINDOW bands: a soft column over the stretch of track where an updraft, gust or low-gravity pocket will act, brightening over the 0.65 s lead and pulsing while it acts
 *    (updraft: warm additive light; gust: blue and low gravity: violet, tinted so they read on the bright snow and clouds). Only one of the two band meshes is ever on screen;
 *  - PARTICLES inside the bands: heat rising, snow blowing up or down, slow glints;
 *  - RAILS beside the palace's piston poles, glowing brighter just before a piston comes back.
 * Phase barriers and brittle caps are telegraphed on the obstacles themselves (ObstacleField: translucency, a warm glow and a rumble). Everything is a function of the run distance:
 * nothing reads a clock, and it all stands behind or beside the obstacles, so it can never hide the bird, an obstacle or an orb. Nothing is drawn unless the hazards are on.
 */
export default function HazardTelegraph({ sim }) {
  return HAZARDS.enabled ? <Telegraph sim={sim} /> : null;
}

function bandTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const u = x / 63;
      const v = y / 63;
      const soft = Math.pow(Math.max(0, 1 - Math.abs(u - 0.5) * 2), 0.8); // a soft body...
      const line = Math.max(0, 1 - Math.min(u, 1 - u) / 0.03); // ...with crisp edge lines, so the window's extent reads on any background
      const fade = Math.min(1, v * 6, (1 - v) * 6); // soft top and bottom
      const a = Math.round(255 * Math.min(1, 0.55 * soft + line) * fade);
      const k = (y * 64 + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
      img.data[k + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function Telegraph({ sim }) {
  const bandsAdd = useRef();
  const bandsNorm = useRef();
  const normMat = useRef();
  const dust = useRef();
  const rails = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const tmp = useMemo(() => new Color(), []);
  const tex = useMemo(() => bandTexture(), []);
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(PARTICLES * 3), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(PARTICLES * 3), 3));
    return g;
  }, []);
  const colors = useMemo(() => Object.fromEntries(Object.entries(KIND_STYLE).map(([k, st]) => [k, { band: new Color(st.band), dust: new Color(st.dust), additive: st.additive }])), []);
  const piston = BIOME_HAZARDS.palace.piston;
  // scratch reused every frame: the windows in view, one particle, one rail
  const list = useMemo(() => ({ n: 0, items: Array.from({ length: MAX_WINDOWS }, () => ({ kind: '', s: 0, len: 0, lead: 0, dir: 1 })) }), []);
  const collect = useMemo(
    () => (kind, s, len, lead, dir) => {
      if (list.n >= MAX_WINDOWS) return;
      const w = list.items[list.n++];
      w.kind = kind;
      w.s = s;
      w.len = len;
      w.lead = lead;
      w.dir = dir;
    },
    [list],
  );
  const p = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
  const rail = useMemo(() => ({ x: 0, y0: 0, y1: 0, glow: 0 }), []);
  useEffect(() => () => { tex.dispose(); geo.dispose(); }, [tex, geo]);

  useFrame(() => {
    const d = sim.renderDistance();
    list.n = 0;
    windowsIn(d - 8, d + 70, collect);

    // window bands: the canyon's updraft is additive light, the others tinted bands (one mesh each, the empty one hidden)
    let na = 0;
    let nn = 0;
    let normOpacity = 0;
    const pos = geo.attributes.position.array;
    const col = geo.attributes.color.array;
    const glows = [0, 0, 0];
    for (let k = 0; k < list.n; k++) {
      const w = list.items[k];
      const glow = windowGlow(d, w.s, w.len, w.lead);
      glows[k] = glow;
      if (glow <= 0.001) continue;
      const st = colors[w.kind];
      dummy.position.set(w.s - d + w.len / 2, BAND_BOTTOM + BAND_HEIGHT / 2, BAND_Z);
      dummy.scale.set(w.len, BAND_HEIGHT, 1);
      dummy.updateMatrix();
      if (st.additive) {
        bandsAdd.current.setMatrixAt(na, dummy.matrix);
        bandsAdd.current.setColorAt(na, tmp.copy(st.band).multiplyScalar(glow * 0.55));
        na++;
      } else if (glow > FAR_GLOW + 0.01) {
        // tinted bands appear when the telegraph starts (a faint tint from afar would be clutter on bright scenery)
        bandsNorm.current.setMatrixAt(nn, dummy.matrix);
        bandsNorm.current.setColorAt(nn, tmp.copy(st.band));
        normOpacity = Math.max(normOpacity, glow * 0.85);
        nn++;
      }
    }
    for (const [ref, n] of [[bandsAdd, na], [bandsNorm, nn]]) {
      if (!ref.current) continue;
      ref.current.count = n;
      ref.current.visible = n > 0;
      if (n > 0) {
        ref.current.instanceMatrix.needsUpdate = true;
        if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
      }
    }
    if (normMat.current) normMat.current.opacity = normOpacity;

    // particles: spread over the windows that are telegraphing or acting
    let np = 0;
    if (list.n > 0) {
      for (let i = 0; i < PARTICLES; i++) {
        const w = list.items[i % list.n];
        const glow = glows[i % list.n];
        if (glow <= FAR_GLOW + 0.01) continue;
        particleAt(i, w.kind, w.s, w.len, w.dir, d, p);
        pos[np * 3] = p.x;
        pos[np * 3 + 1] = p.y;
        pos[np * 3 + 2] = p.z;
        const dc = colors[w.kind].dust;
        col[np * 3] = dc.r;
        col[np * 3 + 1] = dc.g;
        col[np * 3 + 2] = dc.b;
        np++;
      }
    }
    if (dust.current) {
      geo.setDrawRange(0, np);
      dust.current.visible = np > 0;
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    }

    // piston rails
    let nr = 0;
    if (rails.current) {
      for (const o of sim.obstacles.active) {
        if (nr >= MAX_RAILS) break;
        if (!o.dyn || o.kit !== 'palace' || o.kind !== 'column') continue;
        const x = o.x - d;
        if (x < -12 || x > 60) continue;
        railFor(o, piston.amp, d, rail);
        dummy.position.set(rail.x, (rail.y0 + rail.y1) / 2, 0.2);
        dummy.scale.set(0.09, Math.abs(rail.y1 - rail.y0), 1);
        dummy.updateMatrix();
        rails.current.setMatrixAt(nr, dummy.matrix);
        rails.current.setColorAt(nr, tmp.set('#ffd27a').multiplyScalar(rail.glow));
        nr++;
      }
      rails.current.count = nr;
      rails.current.visible = nr > 0;
      if (nr > 0) {
        rails.current.instanceMatrix.needsUpdate = true;
        if (rails.current.instanceColor) rails.current.instanceColor.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      <instancedMesh ref={bandsAdd} args={[undefined, undefined, MAX_WINDOWS]} frustumCulled={false} renderOrder={-1.2} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={tex} transparent blending={AdditiveBlending} depthWrite={false} fog={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={bandsNorm} args={[undefined, undefined, MAX_WINDOWS]} frustumCulled={false} renderOrder={-1.2} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={normMat} map={tex} transparent opacity={0} depthWrite={false} fog={false} toneMapped={false} />
      </instancedMesh>
      <points ref={dust} geometry={geo} frustumCulled={false} renderOrder={-1.1} visible={false}>
        <pointsMaterial size={0.22} vertexColors transparent opacity={0.95} depthWrite={false} fog={false} sizeAttenuation toneMapped={false} />
      </points>
      <instancedMesh ref={rails} args={[undefined, undefined, MAX_RAILS]} frustumCulled={false} renderOrder={2} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial transparent blending={AdditiveBlending} depthWrite={false} fog={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
