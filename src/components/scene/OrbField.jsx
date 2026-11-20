import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CircleGeometry, Color, MeshBasicMaterial, Object3D, PlaneGeometry, SRGBColorSpace, TextureLoader } from 'three';
import { ORB_FAMILIES, ORB_FAMILY_IDS, orbFamilyAt } from '../../systems/world/orbFamilies.js';

/**
 * Score orbs, as five painted families (Solar, Frost, Cosmic, Nature, Celestial: systems/world/orbFamilies.js says which appears where) cut out of public/images/orbs/orbs.webp, ONE atlas texture
 * with one 192 px cell per family. VISUAL ONLY: an orb's collection, hitbox, value and position all come from the simulation exactly as before; this component reads `orb.x`, `orb.y` and
 * `orb.phase` and draws, and the bob, pulse and rocking tilt below only move the picture, never `orb.y`. Behind each picture sits a deep, normally blended glow disc (one colour per family, the same
 * in every world): pale pictures stand out against bright scenery by it, and its edge reads against dark scenery.
 *
 * Draw calls: one InstancedMesh per family that has an orb on screen (a family with none is hidden and costs nothing; usually one or two) plus ONE shared glow disc behind them (its colour is per
 * instance), so about 2 to 4 calls. One small texture, loaded once; until it arrives the glow discs alone mark the orbs. Nothing is allocated per frame.
 */
const MAX_ORBS = 64;
/** Half the size of the picture's quad: the orb is drawn 1.0 across (radius 0.5), the size of the old glow (0.53) and within the unchanged collection reach (0.71). */
const HALF = 0.5;
/** The glow disc is on the picture's plane (draw order puts it behind): at any other depth, perspective would shift it into an uneven crescent. */
const HALO_Z = 0;
const CELLS = ORB_FAMILY_IDS.length;
const CONFIGS = ORB_FAMILY_IDS.map((id) => ORB_FAMILIES[id]);
const ATLAS = `${import.meta.env?.BASE_URL ?? '/'}images/orbs/orbs.webp`;

/** A square quad whose texture coordinates cover family `i`'s cell of the atlas. */
function quad(i) {
  const g = new PlaneGeometry(HALF * 2, HALF * 2);
  const uv = g.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / CELLS);
  return g;
}

export default function OrbField({ sim }) {
  const dummy = useMemo(() => new Object3D(), []);
  const bodies = useRef([]);
  const halos = useRef();
  const loaded = useRef(false);
  const counts = useMemo(() => new Int32Array(CELLS), []);
  const geometries = useMemo(() => ORB_FAMILY_IDS.map((_, i) => quad(i)), []);
  const bodyMat = useMemo(() => new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }), []);
  const haloGeo = useMemo(() => new CircleGeometry(0.46, 28), []);
  const haloMat = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }), []);
  const haloColors = useMemo(() => CONFIGS.map((f) => new Color(f.halo)), []);
  const glows = useMemo(() => CONFIGS.map((f) => new Color(f.glow, f.glow, f.glow)), []); // multiplies the picture: above 1 lifts a dark one

  useEffect(() => {
    let alive = true;
    const tex = new TextureLoader().load(ATLAS, () => {
      if (!alive) return;
      bodyMat.map = tex;
      bodyMat.needsUpdate = true;
      loaded.current = true;
    });
    tex.colorSpace = SRGBColorSpace;
    return () => {
      alive = false;
      loaded.current = false;
      tex.dispose();
      bodyMat.dispose();
      haloMat.dispose();
      haloGeo.dispose();
      geometries.forEach((g) => g.dispose());
    };
  }, [bodyMat, haloMat, haloGeo, geometries]);

  useFrame(() => {
    const halo = halos.current;
    if (!halo) return;
    const dist = sim.renderDistance();
    const t = sim.time;
    counts.fill(0);
    let n = 0;
    for (const orb of sim.orbs.active) {
      const x = orb.x - dist;
      if (x < -15 || x > 60 || n >= MAX_ORBS) continue;
      const fi = ORB_FAMILY_IDS.indexOf(orbFamilyAt(orb.x));
      if (counts[fi] >= MAX_ORBS) continue;
      const f = CONFIGS[fi];
      // small per-orb differences in phase (the orb's own animation phase), so a trail never moves in lockstep
      const y = orb.y + Math.sin(t * f.bobSpeed + orb.phase) * f.bob;
      const pulse = 1 + Math.sin(t * f.pulseSpeed + orb.phase) * f.pulse;

      if (loaded.current) {
        dummy.position.set(x, y, 0);
        dummy.rotation.set(0, 0, Math.sin(t * f.swaySpeed + orb.phase) * f.sway); // a gentle rocking tilt (a steady spin would turn the painted highlights)
        dummy.scale.setScalar(pulse);
        dummy.updateMatrix();
        bodies.current[fi].setColorAt(counts[fi], glows[fi]);
        bodies.current[fi].setMatrixAt(counts[fi]++, dummy.matrix);
      }

      dummy.position.set(x, y, HALO_Z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(pulse * 1.2);
      dummy.updateMatrix();
      halo.setMatrixAt(n, dummy.matrix);
      halo.setColorAt(n, haloColors[fi]);
      n++;
    }
    for (let i = 0; i < CELLS; i++) {
      const body = bodies.current[i];
      body.count = counts[i];
      body.visible = counts[i] > 0; // a family with nothing on screen is not drawn at all
      if (counts[i] > 0) {
        body.instanceMatrix.needsUpdate = true;
        if (body.instanceColor) body.instanceColor.needsUpdate = true;
      }
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
      <instancedMesh ref={halos} args={[haloGeo, haloMat, MAX_ORBS]} frustumCulled={false} renderOrder={2} visible={false} />
      {geometries.map((geometry, i) => (
        <instancedMesh
          key={ORB_FAMILY_IDS[i]}
          ref={(m) => {
            bodies.current[i] = m;
          }}
          args={[geometry, bodyMat, MAX_ORBS]}
          frustumCulled={false}
          renderOrder={3}
          visible={false}
        />
      ))}
    </group>
  );
}
