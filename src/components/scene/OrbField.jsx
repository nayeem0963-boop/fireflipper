import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, CircleGeometry, Color, MeshBasicMaterial, NormalBlending, Object3D } from 'three';
import { dominantZone } from '../../systems/world/biomes.js';
import { ORB_FAMILIES, ORB_FAMILY_IDS, orbFamilyAt } from '../../systems/world/orbFamilies.js';
import { orbGeometry } from './orbGeometry.js';

/**
 * Score orbs, in five visual families (Solar, Frost, Cosmic, Nature, Celestial: see systems/world/orbFamilies.js for the look, the colours and which family appears where, and
 * orbGeometry.js for the silhouettes). VISUAL ONLY: an orb's collection, hitbox, value and position all come from the simulation exactly as before; this component reads `orb.x`,
 * `orb.y` and `orb.phase` and draws, and the bob and pulse below only move the picture, never `orb.y`.
 *
 * Draw calls: one InstancedMesh per family that has an orb on screen (a family with none is hidden and costs nothing; usually one or two) plus ONE shared glow disc behind them (its
 * colour is per instance), so about 2 to 4 calls, against the 2 of the old orb. Nothing is allocated per frame: the matrices, colours and counters are reused.
 */
const MAX_ORBS = 64;
/** The glow disc sits behind every body (the tumbling rings reach about 0.33 in depth), so it never washes over an orb's colours. */
const HALO_Z = -0.38;
const TAU = Math.PI * 2;
const CONFIGS = ORB_FAMILY_IDS.map((id) => ORB_FAMILIES[id]);

export default function OrbField({ sim }) {
  const dummy = useMemo(() => new Object3D(), []);
  const bodies = useRef([]);
  const halos = useRef();
  const style = useRef('');
  const counts = useMemo(() => new Int32Array(ORB_FAMILY_IDS.length), []);
  const geometries = useMemo(() => ORB_FAMILY_IDS.map(orbGeometry), []);
  const bodyMat = useMemo(() => new MeshBasicMaterial({ vertexColors: true, toneMapped: false }), []);
  const haloGeo = useMemo(() => new CircleGeometry(0.46, 28), []);
  const haloMat = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0.35, depthWrite: false, blending: AdditiveBlending, toneMapped: false }), []);
  const haloColors = useMemo(() => CONFIGS.map((f) => ({ day: new Color(f.haloDay), night: new Color(f.haloNight) })), []);
  useEffect(
    () => () => {
      bodyMat.dispose();
      haloMat.dispose();
      haloGeo.dispose();
    },
    [bodyMat, haloMat, haloGeo],
  );

  useFrame(() => {
    const halo = halos.current;
    if (!halo) return;
    const dist = sim.renderDistance();
    // On bright scenery an additive glow washes out, so the glow switches to a deep, normally blended colour (each family has one) behind the orb; in the night world it stays additive.
    const zone = dominantZone(dist);
    const day = zone?.orbStyle === 'day';
    const key = day ? 'day' : 'night';
    if (key !== style.current) {
      style.current = key;
      haloMat.blending = day ? NormalBlending : AdditiveBlending;
      haloMat.opacity = day ? 0.6 : 0.35;
      haloMat.needsUpdate = true;
    }
    const t = sim.time;
    counts.fill(0);
    let n = 0;
    for (const orb of sim.orbs.active) {
      const x = orb.x - dist;
      if (x < -15 || x > 60 || n >= MAX_ORBS) continue;
      const fi = ORB_FAMILY_IDS.indexOf(orbFamilyAt(orb.x));
      if (counts[fi] >= MAX_ORBS) continue;
      const f = CONFIGS[fi];
      const body = bodies.current[fi];
      // small per-orb differences in speed and phase (from the orb's own animation phase), so a trail never moves in lockstep
      const speed = 0.85 + 0.3 * (orb.phase / TAU);
      const a = t * f.spin * speed + orb.phase;
      const y = orb.y + Math.sin(t * f.bobSpeed + orb.phase) * f.bob;
      const pulse = 1 + Math.sin(t * f.pulseSpeed + orb.phase) * f.pulse;

      dummy.position.set(x, y, 0);
      switch (fi) {
        case 0: // Solar: spins in the camera's plane
          dummy.rotation.set(0, 0, a);
          break;
        case 1: // Frost: a slow, opposite turn with a small sway
          dummy.rotation.set(0, Math.sin(a * 0.7) * 0.35, a);
          break;
        case 2: // Cosmic: the crossed rings tumble
          dummy.rotation.set(a * 0.7, a, 0);
          break;
        case 3: // Nature: turns slowly and sways like a leaf
          dummy.rotation.set(0, Math.sin(a * 0.9) * 0.55, a * 0.6);
          break;
        default: // Celestial: the tilted halo ring turns round the star
          dummy.rotation.set(0, a, 0);
      }
      dummy.scale.setScalar(pulse);
      dummy.updateMatrix();
      body.setMatrixAt(counts[fi]++, dummy.matrix);

      dummy.position.set(x, y, HALO_Z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(pulse * 1.15);
      dummy.updateMatrix();
      halo.setMatrixAt(n, dummy.matrix);
      halo.setColorAt(n, haloColors[fi][key]);
      n++;
    }
    for (let i = 0; i < ORB_FAMILY_IDS.length; i++) {
      const body = bodies.current[i];
      body.count = counts[i];
      body.visible = counts[i] > 0; // a family with nothing on screen is not drawn at all
      if (counts[i] > 0) body.instanceMatrix.needsUpdate = true;
    }
    halo.count = n;
    halo.visible = n > 0;
    if (n > 0) {
      halo.instanceMatrix.needsUpdate = true;
      if (halo.instanceColor) halo.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      {geometries.map((geometry, i) => (
        <instancedMesh
          key={ORB_FAMILY_IDS[i]}
          ref={(m) => {
            bodies.current[i] = m;
          }}
          args={[geometry, bodyMat, MAX_ORBS]}
          frustumCulled={false}
          visible={false}
        />
      ))}
      <instancedMesh ref={halos} args={[haloGeo, haloMat, MAX_ORBS]} frustumCulled={false} renderOrder={2} visible={false} />
    </group>
  );
}
