import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, CanvasTexture, Color, Object3D, SRGBColorSpace } from 'three';
import { WORLD } from '../../systems/physics/constants.js';

/**
 * Air currents: a faint column over each zone plus streaks that drift up (updraft) or down (downdraft)
 * through it, so the direction reads at a glance. Streaks are one InstancedMesh; positions are a pure function
 * of time, so nothing is allocated per frame.
 */
const STREAKS = 120;
const ZONES = 3;
const BAND = WORLD.ceilingY - WORLD.groundY + 1;
const UP = new Color('#8fd8ff');
const DOWN = new Color('#ff7a8a');

/** A soft column: fades out toward its top, bottom and sides so a zone has no hard edges. */
function createColumnTexture() {
  const w = 64;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const fx = Math.min(x, w - 1 - x) / (w * 0.35);
      const fy = Math.min(y, h - 1 - y) / (h * 0.3);
      const a = Math.min(1, fx) * Math.min(1, fy);
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * a * a);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export default function WindField({ sim }) {
  const streaks = useRef();
  const panels = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const tint = useMemo(() => new Color(), []);
  const column = useMemo(createColumnTexture, []);

  // Instance colours must exist before the first frame, or the material compiles without them.
  useEffect(() => {
    for (let i = 0; i < ZONES; i++) panels.current?.setColorAt(i, UP);
    for (let i = 0; i < STREAKS; i++) streaks.current?.setColorAt(i, UP);
    return () => column.dispose();
  }, [column]);

  useFrame(() => {
    if (!streaks.current) return;
    const dist = sim.renderDistance();
    const t = sim.time;
    let n = 0;
    let z = 0;
    for (const w of sim.winds.active) {
      const x0 = w.x0 - dist;
      const x1 = w.x1 - dist;
      if (x1 < -12 || x0 > 55 || z >= ZONES) continue;
      const up = w.accel > 0;
      const color = up ? UP : DOWN;
      const width = w.x1 - w.x0;

      dummy.position.set((x0 + x1) / 2, WORLD.groundY + BAND / 2 - 0.5, -0.6);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(width, BAND, 1);
      dummy.updateMatrix();
      panels.current.setMatrixAt(z, dummy.matrix);
      panels.current.setColorAt(z, color);
      z++;

      const perZone = Math.floor(STREAKS / ZONES);
      for (let i = 0; i < perZone && n < STREAKS; i++) {
        // Each streak has a fixed column inside the zone and rises/falls at a steady speed, wrapping around.
        const fx = ((i * 0.6180339) % 1) * width;
        const speed = 3.2 + (i % 4) * 0.7;
        const phase = (((t * speed * (up ? 1 : -1) + i * 1.7) % BAND) + BAND) % BAND;
        dummy.position.set(x0 + fx, WORLD.groundY - 0.5 + phase, -0.5);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(0.06, 0.8, 1);
        dummy.updateMatrix();
        streaks.current.setMatrixAt(n, dummy.matrix);
        tint.copy(color);
        streaks.current.setColorAt(n, tint);
        n++;
      }
    }
    streaks.current.count = n;
    panels.current.count = z;
    streaks.current.instanceMatrix.needsUpdate = true;
    panels.current.instanceMatrix.needsUpdate = true;
    if (streaks.current.instanceColor) streaks.current.instanceColor.needsUpdate = true;
    if (panels.current.instanceColor) panels.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={panels} args={[undefined, undefined, ZONES]} frustumCulled={false} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={column}
          transparent
          opacity={0.3}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={streaks}
        args={[undefined, undefined, STREAKS]}
        frustumCulled={false}
        renderOrder={1}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          transparent
          opacity={0.8}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}
