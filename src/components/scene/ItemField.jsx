import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshBasicMaterial, Object3D, PlaneGeometry, SRGBColorSpace, TextureLoader } from 'three';
import { worldIndexAt } from '../../systems/world/worlds.js';

/**
 * Power-up items (the magnet and the shield), drawn from public/images/powerups/powerups.webp: ONE atlas of 5 columns (the five worlds, whose colours each picture is graded for) by 2 rows (magnet on
 * top, shield below), 192 px a cell. VISUAL ONLY: pickup comes from the simulation's circle test on `item.x` / `item.y`; this reads them and draws, with a bob, a pulse and a rocking tilt that only move
 * the picture. No outline. A cell's mesh is hidden while no item of that kind and world is on screen (items are rare, so usually nothing is drawn); nothing is allocated per frame.
 */
const COLS = 5;
const ROWS = 2;
const CELLS = COLS * ROWS;
const MAX = 4;
/** Items are drawn larger than score orbs (1.3 across against 1.0) so they read as special. */
const HALF = 0.65;
const ATLAS = `${import.meta.env?.BASE_URL ?? '/'}images/powerups/powerups.webp`;
const ROW = { magnet: 0, shield: 1 };

/** A square quad covering one cell of the atlas (column = world, row = kind). */
function quad(col, row) {
  const g = new PlaneGeometry(HALF * 2, HALF * 2);
  const uv = g.attributes.uv;
  for (let k = 0; k < uv.count; k++) {
    uv.setX(k, (col + uv.getX(k)) / COLS);
    uv.setY(k, 1 - (row + 1) / ROWS + uv.getY(k) / ROWS);
  }
  return g;
}

export default function ItemField({ sim }) {
  const dummy = useMemo(() => new Object3D(), []);
  const meshes = useRef([]);
  const loaded = useRef(false);
  const counts = useMemo(() => new Int32Array(CELLS), []);
  const geometries = useMemo(() => Array.from({ length: CELLS }, (_, i) => quad(i % COLS, Math.floor(i / COLS))), []);
  const material = useMemo(() => new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }), []);

  useEffect(() => {
    let alive = true;
    const tex = new TextureLoader().load(ATLAS, () => {
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
    if (!meshes.current[0]) return;
    const dist = sim.renderDistance();
    const t = sim.time;
    counts.fill(0);
    if (loaded.current) {
      for (const it of sim.items.active) {
        const x = it.x - dist;
        if (x < -15 || x > 60) continue;
        const cell = ROW[it.kind] * COLS + worldIndexAt(it.x);
        if (counts[cell] >= MAX) continue;
        dummy.position.set(x, it.y + Math.sin(t * 2.4 + it.phase) * 0.18, 0.05);
        dummy.rotation.set(0, 0, Math.sin(t * 1.4 + it.phase) * 0.25);
        dummy.scale.setScalar(1 + Math.sin(t * 4.5 + it.phase) * 0.1);
        dummy.updateMatrix();
        meshes.current[cell].setMatrixAt(counts[cell]++, dummy.matrix);
      }
    }
    for (let i = 0; i < CELLS; i++) {
      const m = meshes.current[i];
      m.count = counts[i];
      m.visible = counts[i] > 0;
      if (counts[i] > 0) m.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {geometries.map((geometry, i) => (
        <instancedMesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          args={[geometry, material, MAX]}
          frustumCulled={false}
          renderOrder={4}
          visible={false}
        />
      ))}
    </group>
  );
}
