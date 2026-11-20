import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { AMBIENT, DRIFT, auroraStrength, driftItems, driftPoint, pulse } from '../../systems/world/ambient.js';
import { BAND_Z } from './ZoneParts.jsx';

/**
 * Ambient animation for the painted zones, driven only by the run distance (so it freezes on pause, is frame-rate independent and uses no wall clock):
 * DriftParticles (canyon dust, snow, sparkles, petals: one Points draw call, all behind the flight plane) and AuroraShimmer (soft additive streaks over the
 * Frosty Polar sky). Purely visual.
 */
const SEEDS = { canyon: 11, arctic: 22, celestial: 33, palace: 44, sanctuary: 55 };

export function DriftParticles({ sim, wRef, zoneId }) {
  const cfg = DRIFT[zoneId];
  const items = useMemo(() => driftItems(SEEDS[zoneId]), [zoneId]);
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(items.length * 3), 3));
    return g;
  }, [items]);
  const mat = useRef();
  const pts = useRef();
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame(({ camera }) => {
    const w = wRef.current;
    if (!pts.current) return;
    pts.current.visible = w > 0.001;
    if (w <= 0.001) return;
    const d = sim.renderDistance();
    const a = geo.attributes.position.array;
    for (let i = 0; i < items.length; i++) {
      const p = driftPoint(items[i], d, cfg);
      a[i * 3] = camera.position.x + p.x;
      a[i * 3 + 1] = p.y;
      a[i * 3 + 2] = p.z;
    }
    geo.attributes.position.needsUpdate = true;
    if (mat.current) mat.current.opacity = cfg.opacity * Math.min(1, w * 2);
  });
  return (
    <points ref={pts} geometry={geo} frustumCulled={false} renderOrder={-1}>
      <pointsMaterial ref={mat} color={cfg.color} size={cfg.size} sizeAttenuation transparent depthWrite={false} fog={false} opacity={0} />
    </points>
  );
}

function createAuroraTexture() {
  const w = 256, h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  // vertical curtains: each column fades out towards the bottom and the top, with a green-to-violet hue across the width (repeats seamlessly)
  let s = 7;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let x = 0; x < w; x++) {
    const t = x / w;
    const hue = 150 + 120 * (0.5 + 0.5 * Math.sin(t * Math.PI * 4));
    const amp = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(t * Math.PI * 14 + rand() * 0.6), 2);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `hsla(${hue},90%,70%,0)`);
    g.addColorStop(0.35, `hsla(${hue},90%,68%,${0.55 * amp})`);
    g.addColorStop(1, `hsla(${hue},90%,60%,0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 1, h);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  return t;
}

export function AuroraShimmer({ sim, wRef }) {
  const mesh = useRef();
  const mat = useRef();
  const tex = useMemo(() => createAuroraTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame(({ camera }) => {
    const m = mesh.current;
    if (!m) return;
    const d = sim.renderDistance();
    const k = auroraStrength(d) * wRef.current;
    m.visible = k > 0.002;
    if (!m.visible) return;
    const dist = camera.position.z - BAND_Z;
    const viewH = 2 * dist * Math.tan((camera.fov * Math.PI) / 360);
    const viewW = viewH * camera.aspect;
    m.position.set(camera.position.x, camera.position.y + viewH * 0.22, BAND_Z + 0.06);
    m.scale.set(viewW * 1.1, viewH * 0.6, 1);
    tex.repeat.set(2, 1);
    tex.offset.x = (d * 0.0016) % 1; // the curtains drift sideways with the run
    mat.current.opacity = 0.32 * k * (0.7 + 0.3 * pulse(d, 90));
  });
  return (
    <mesh ref={mesh} renderOrder={-1.4} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial ref={mat} map={tex} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} fog={false} toneMapped={false} />
    </mesh>
  );
}

export { AMBIENT };
