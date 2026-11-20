import { useTheme } from '../../hooks/useTheme.js';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, CanvasTexture, Color, NormalBlending, Object3D, SRGBColorSpace } from 'three';
import { dominantZone } from '../../systems/world/biomes.js';
import { WORLD } from '../../systems/physics/constants.js';

/**
 * Incoming-obstacle warning for narrow (portrait) screens, where the
 * camera can only show ~0.6-1.0 s of track ahead.
 *
 * For each obstacle that is still just beyond the right edge of the view
 * (up to WARN_TIME seconds away), a soft glow bar is drawn along the right
 * edge covering that obstacle's height. The dark gaps between bars show
 * where the opening will be. Bars brighten as the obstacle approaches.
 *
 * One InstancedMesh, per-instance colour for intensity; nothing allocated
 * per frame. Purely visual: it never affects gameplay.
 *
 * On a dark scene the bars glow (additive blending). On a pale daytime scene (the Red Rock Canyon, the Arctic, the Rose Sky Palace) an additive glow
 * would just wash out to white and hide the gaps, so there the bars are drawn with normal blending in the theme's deep daytime colour,
 * fading from pale (far) to saturated (near).
 */
const WARN_TIME = 0.45; // seconds of extra warning
const MAX_BARS = 24;
const BAR_WIDTH = 0.6;

function createEdgeGradient() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 4;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 4);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export default function EdgeWarning({ sim, enabled }) {
  const { scene } = useTheme();
  const BAR_COLOR = useMemo(() => new Color(scene.edgeWarn), [scene]);
  const DAY_COLOR = useMemo(() => new Color(scene.orbHaloDay), [scene]);
  const ZONE_COLOR = useMemo(() => new Color(), []);
  const mat = useRef();
  const isDay = useRef(null);
  const white = useMemo(() => new Color('#ffffff'), []);
  const bars = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const tint = useMemo(() => new Color(), []);
  const gradient = useMemo(createEdgeGradient, []);
  useEffect(() => () => gradient.dispose(), [gradient]);

  // Create the per-instance colour buffer up front so the shader is compiled
  // with instance colours from the first frame.
  useLayoutEffect(() => {
    const mesh = bars.current;
    for (let i = 0; i < MAX_BARS; i++) mesh.setColorAt(i, BAR_COLOR);
    mesh.count = 0;
  }, [BAR_COLOR]);

  useFrame(({ camera }) => {
    const mesh = bars.current;
    if (!mesh) return;
    const zone = dominantZone(sim.renderDistance());
    const day = zone?.orbStyle === 'day';
    if (day !== isDay.current && mat.current) {
      isDay.current = day;
      mat.current.blending = day ? NormalBlending : AdditiveBlending;
      mat.current.needsUpdate = true;
    }
    let n = 0;
    if (enabled && sim.phase === 'running') {
      const halfWidth = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z * camera.aspect;
      const edge = camera.position.x + halfWidth; // right edge of view, in render x
      const dist = sim.renderDistance();
      const range = sim.speed * WARN_TIME;
      const barX = edge - BAR_WIDTH / 2;

      for (const o of sim.obstacles.active) {
        if (n >= MAX_BARS) break;
        const ahead = o.x - o.extent - dist - edge; // how far beyond the edge its leading face is
        if (ahead < 0 || ahead > range) continue;
        const half = o.shape === 'circle' ? o.r : o.h / 2;
        const lo = Math.max(o.y - half, WORLD.groundY);
        const hi = Math.min(o.y + half, WORLD.ceilingY + 1.5);
        if (hi <= lo) continue;
        const intensity = 0.25 + 0.75 * (1 - ahead / range);
        dummy.position.set(barX, (lo + hi) / 2, 0);
        dummy.scale.set(BAR_WIDTH, hi - lo, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(n, dummy.matrix);
        if (day) mesh.setColorAt(n, tint.copy(zone.warn ? ZONE_COLOR.set(zone.warn) : DAY_COLOR).lerp(white, (1 - intensity) * 0.65));
        else mesh.setColorAt(n, tint.copy(BAR_COLOR).multiplyScalar(intensity));
        n++;
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={bars} args={[undefined, undefined, MAX_BARS]} frustumCulled={false} renderOrder={5}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial ref={mat} map={gradient} transparent depthWrite={false} depthTest={false} blending={AdditiveBlending} toneMapped={false} />
    </instancedMesh>
  );
}
