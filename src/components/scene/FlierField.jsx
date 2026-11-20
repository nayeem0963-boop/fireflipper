import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshBasicMaterial, Object3D, PlaneGeometry, SRGBColorSpace, TextureLoader } from 'three';
import { worldIndexAt } from '../../systems/world/worlds.js';
import { ATLAS, ATLAS_COLS, ATLAS_ROWS, FLIERS, ROLE, SHAPE, SLOTS, flierPlace } from '../../systems/fliers/fliers.js';

/**
 * Flying hazards (systems/fliers): the harmless crystal burst (id 'smoke'; fire crystals or ice crystals, graded per world), the fire and energy rings, the ember tornado and the metal disc, drawn from public/images/hazards/hazards.webp, ONE atlas with a cell per
 * (hazard, world) pair, colour-graded for the world the hazard appears in. VISUAL ONLY: what touches the bird is decided by the simulation from the same pure function (`flierPlace`) this file draws
 * from, at the bird's distance, so the picture and the hitbox cannot drift apart. No outline. A hazard's mesh is hidden while none of its kind is on screen (usually nothing is drawn); nothing is
 * allocated per frame. The harmless smoke is drawn behind the obstacles, the orbs and the bird, so it can never hide anything that matters.
 */
const MAX = 2;
const ATLAS_URL = `${import.meta.env?.BASE_URL ?? '/'}images/hazards/hazards.webp`;
const CELLS = Object.keys(ATLAS);

/** A square quad covering one cell of the atlas. */
function quad(half, cell) {
  const g = new PlaneGeometry(half * 2, half * 2);
  const uv = g.attributes.uv;
  for (let k = 0; k < uv.count; k++) {
    uv.setX(k, (cell.col + uv.getX(k)) / ATLAS_COLS);
    uv.setY(k, 1 - (cell.row + 1) / ATLAS_ROWS + uv.getY(k) / ATLAS_ROWS);
  }
  return g;
}

export default function FlierField({ sim }) {
  const dummy = useMemo(() => new Object3D(), []);
  const place = useMemo(() => ({ x: 0, dx: 0, y: 0 }), []);
  const meshes = useRef({});
  const loaded = useRef(false);
  const counts = useMemo(() => new Int32Array(CELLS.length), []);
  const geometries = useMemo(() => CELLS.map((key) => quad(SHAPE[key.split(':')[0]].half, ATLAS[key])), []);
  const material = useMemo(() => new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }), []);

  useEffect(() => {
    let alive = true;
    const tex = new TextureLoader().load(ATLAS_URL, () => {
      if (!alive) return;
      material.map = tex;
      material.needsUpdate = true;
      loaded.current = true;
    });
    tex.colorSpace = SRGBColorSpace;
    return () => {
      alive = false;
      loaded.current = false;
      tex.dispose();
      material.dispose();
      geometries.forEach((g) => g.dispose());
    };
  }, [material, geometries]);

  useFrame(() => {
    const dist = sim.renderDistance();
    counts.fill(0);
    if (FLIERS.enabled && loaded.current) {
      for (let i = 0; i < SLOTS.length; i++) {
        const sl = SLOTS[i];
        if (sl.e < dist - 14 || sl.e > dist + 90) continue;
        flierPlace(sl, dist, place);
        if (place.dx < -16 || place.dx > 62) continue;
        const key = `${sl.kind}:${worldIndexAt(sl.e)}`;
        const ci = CELLS.indexOf(key);
        if (ci < 0 || counts[ci] >= MAX) continue;
        const harmless = ROLE[sl.kind] === 'harmless';
        dummy.position.set(place.dx, place.y, harmless ? -1.4 : 0.2);
        // the disc spins, the tornado sways, the rings wobble a little, the smoke breathes (all functions of the distance: frozen by pause)
        const rot = sl.kind === 'disc' ? dist * 0.9 : sl.kind === 'tornado' ? Math.sin(dist * 0.3) * 0.07 : harmless ? 0 : Math.sin(dist * 0.2 + sl.e) * 0.06;
        dummy.rotation.set(0, 0, rot);
        dummy.scale.setScalar(harmless ? 1 + Math.sin(dist * 0.05 + sl.e) * 0.04 : 1);
        dummy.updateMatrix();
        meshes.current[key].setMatrixAt(counts[ci]++, dummy.matrix);
      }
    }
    for (let c = 0; c < CELLS.length; c++) {
      const m = meshes.current[CELLS[c]];
      if (!m) continue;
      m.count = counts[c];
      m.visible = counts[c] > 0;
      if (counts[c] > 0) m.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {CELLS.map((key, i) => (
        <instancedMesh
          key={key}
          ref={(m) => {
            meshes.current[key] = m;
          }}
          args={[geometries[i], material, MAX]}
          frustumCulled={false}
          renderOrder={ROLE[key.split(':')[0]] === 'harmless' ? 1 : 5}
          visible={false}
        />
      ))}
    </group>
  );
}
