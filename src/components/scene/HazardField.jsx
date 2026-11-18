import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, CanvasTexture, Color, Object3D, SRGBColorSpace } from 'three';
import { WORLD } from '../../systems/physics/constants.js';
import { RING, SPINNER } from '../../systems/obstacles/dynamics.js';
import { RENDER_CAPS } from '../../systems/obstacles/renderCaps.js';

/**
 * Moving hazards and optional bonuses, each with its own silhouette and colour
 * so they are told apart at a glance (static pillars and rocks stay brown):
 *   - falling boulders: near-black rock with a red-hot glow, plus a red
 *     warning lane that brightens before the boulder drops
 *   - lava columns:     bright molten yellow, round, with a white-hot tip
 *   - spinners:         a thick red-hot bar on a dark hub
 *   - fire rings:       a golden ring with a halo (fly through for a bonus)
 *
 * Everything is instanced (about 9 draw calls for all of it) and rewritten
 * from simulation state each frame. Render sizes are always at least the
 * collider's, so a hit never happens on empty space.
 */
const MAX = RENDER_CAPS;
const LANE_TOP = 7.6;
const RING_TILT = 1.1; // radians about the vertical axis

function createLaneTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 4;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 4);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export default function HazardField({ sim }) {
  const boulders = useRef();
  const boulderGlow = useRef();
  const lanes = useRef();
  const geysers = useRef();
  const geyserTips = useRef();
  const hubs = useRef();
  const bars = useRef();
  const rings = useRef();
  const ringHalos = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const tint = useMemo(() => new Color(), []);
  const laneTexture = useMemo(createLaneTexture, []);

  // Per-instance colour buffer up front so the lane shader is compiled with it.
  useLayoutEffect(() => {
    for (let i = 0; i < MAX.boulder; i++) lanes.current.setColorAt(i, tint.set('#ff3a1a'));
    lanes.current.count = 0;
  }, [tint]);

  useFrame(() => {
    if (!boulders.current) return;
    const dist = sim.renderDistance();
    const t = sim.time;
    let nB = 0;
    let nG = 0;
    let nS = 0;
    let nR = 0;

    for (const o of sim.obstacles.active) {
      const x = o.x - dist;
      if (x < -20 - o.extent || x > 60) continue;

      if (o.kind === 'boulder') {
        if (nB >= MAX.boulder) continue;
        if (!o.gone) {
          dummy.position.set(x, o.y, 0);
          // Tumbles faster as it falls.
          dummy.rotation.set(o.rot + (o.p1 - o.y) * 0.5, o.rot * 1.4 + (o.p1 - o.y) * 0.35, o.rot * 0.5);
          dummy.scale.set(o.r, o.r, o.r);
          dummy.updateMatrix();
          boulders.current.setMatrixAt(nB, dummy.matrix);
          dummy.scale.setScalar(o.r * 1.35);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          boulderGlow.current.setMatrixAt(nB, dummy.matrix);
        } else {
          dummy.scale.setScalar(0.0001);
          dummy.updateMatrix();
          boulders.current.setMatrixAt(nB, dummy.matrix);
          boulderGlow.current.setMatrixAt(nB, dummy.matrix);
        }
        // Warning lane: glows (and pulses faster) as the drop approaches, then fades once it has landed.
        const live = o.gone ? 0 : o.landed ? 0.35 : 1;
        const pulse = 0.65 + 0.35 * Math.sin(t * (6 + o.arm * 10));
        const lane = o.arm * live * pulse;
        dummy.position.set(x, (WORLD.groundY + LANE_TOP) / 2, -0.25);
        dummy.scale.set(2 * (o.r + 0.2), LANE_TOP - WORLD.groundY, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        lanes.current.setMatrixAt(nB, dummy.matrix);
        lanes.current.setColorAt(nB, tint.set('#ff3a1a').multiplyScalar(lane * 0.85));
        nB++;
      } else if (o.kind === 'geyser') {
        if (nG >= MAX.geyser) continue;
        const top = o.y + o.h / 2;
        dummy.position.set(x, o.y, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(o.w, o.h, o.w);
        dummy.updateMatrix();
        geysers.current.setMatrixAt(nG, dummy.matrix);
        // White-hot tip that flares as the column reaches full height.
        dummy.position.set(x, top - 0.05, 0);
        dummy.scale.set(o.w * 1.12, 0.22 + o.arm * 0.2, o.w * 1.12);
        dummy.updateMatrix();
        geyserTips.current.setMatrixAt(nG, dummy.matrix);
        nG++;
      } else if (o.kind === 'spinner') {
        if (nS >= MAX.spinner) continue;
        const half = SPINNER.offsets[SPINNER.offsets.length - 1] + SPINNER.nodeRadius;
        dummy.position.set(x, o.y, 0);
        dummy.rotation.set(0, 0, o.rot);
        dummy.scale.set(half * 2, 0.6, 0.55);
        dummy.updateMatrix();
        bars.current.setMatrixAt(nS, dummy.matrix);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(0.46);
        dummy.updateMatrix();
        hubs.current.setMatrixAt(nS, dummy.matrix);
        nS++;
      } else if (o.kind === 'ring') {
        if (nR >= MAX.ring) continue;
        const flicker = 1 + Math.sin(t * 7 + o.x) * 0.03;
        dummy.position.set(x, o.y, 0);
        // Turned toward the flight line so it reads as a hoop to fly through.
        dummy.rotation.set(0, RING_TILT, 0);
        dummy.scale.set(flicker, flicker, 1);
        dummy.updateMatrix();
        rings.current.setMatrixAt(nR, dummy.matrix);
        dummy.scale.set(1.04, 1.04, 1);
        dummy.updateMatrix();
        ringHalos.current.setMatrixAt(nR, dummy.matrix);
        nR++;
      }
    }

    const commit = (mesh, n) => {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    };
    commit(boulders.current, nB);
    commit(boulderGlow.current, nB);
    commit(lanes.current, nB);
    if (lanes.current.instanceColor) lanes.current.instanceColor.needsUpdate = true;
    commit(geysers.current, nG);
    commit(geyserTips.current, nG);
    commit(bars.current, nS);
    commit(hubs.current, nS);
    commit(rings.current, nR);
    commit(ringHalos.current, nR);
  });

  return (
    <group>
      {/* Boulders */}
      <instancedMesh ref={boulders} args={[undefined, undefined, MAX.boulder]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#2b2220" emissive="#ff2a08" emissiveIntensity={0.75} roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={boulderGlow} args={[undefined, undefined, MAX.boulder]} frustumCulled={false} renderOrder={2}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ff3a14" transparent opacity={0.28} depthWrite={false} blending={AdditiveBlending} fog={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={lanes} args={[undefined, undefined, MAX.boulder]} frustumCulled={false} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={laneTexture} transparent depthWrite={false} blending={AdditiveBlending} fog={false} toneMapped={false} />
      </instancedMesh>

      {/* Lava columns */}
      <instancedMesh ref={geysers} args={[undefined, undefined, MAX.geyser]} frustumCulled={false}>
        <cylinderGeometry args={[0.5, 0.5, 1, 14]} />
        <meshBasicMaterial color="#ffae2b" fog={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={geyserTips} args={[undefined, undefined, MAX.geyser]} frustumCulled={false}>
        <cylinderGeometry args={[0.5, 0.5, 1, 14]} />
        <meshBasicMaterial color="#fff4c2" fog={false} toneMapped={false} />
      </instancedMesh>

      {/* Spinners */}
      <instancedMesh ref={bars} args={[undefined, undefined, MAX.spinner]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#b3201a" emissive="#ff2a10" emissiveIntensity={1.1} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={hubs} args={[undefined, undefined, MAX.spinner]} frustumCulled={false}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color="#1c1514" emissive="#ff6a2a" emissiveIntensity={0.5} roughness={0.4} metalness={0.4} />
      </instancedMesh>

      {/* Fire rings */}
      <instancedMesh ref={rings} args={[undefined, undefined, MAX.ring]} frustumCulled={false}>
        <torusGeometry args={[RING.radius, RING.nodeRadius * 1.08, 10, 32]} />
        <meshBasicMaterial color="#ffc43a" fog={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={ringHalos} args={[undefined, undefined, MAX.ring]} frustumCulled={false} renderOrder={2}>
        <torusGeometry args={[RING.radius, RING.nodeRadius * 2.1, 8, 32]} />
        <meshBasicMaterial color="#ff8a1c" transparent opacity={0.3} depthWrite={false} blending={AdditiveBlending} fog={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
