import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshBasicMaterial, Object3D, PlaneGeometry } from 'three';
import { worldIndexAt } from '../../systems/world/worlds.js';
import { ATLAS, ATLAS_COLS, ATLAS_ROWS, FLIERS, ROLE, SHAPE, SLOTS, flierPlace } from '../../systems/fliers/fliers.js';
import { ATLAS_LEAD, createLazyAtlas } from './lazyAtlas.js';

/**
 * Flying hazards (systems/fliers): the harmless crystal burst (id 'smoke'; fire crystals or ice crystals, graded per world), the fire and energy rings, the ember tornado and the metal disc, drawn from public/images/hazards/hazards.webp, ONE atlas with a cell per
 * (hazard, world) pair, colour-graded for the world the hazard appears in. VISUAL ONLY: what touches the bird is decided by the simulation from the same pure function (`flierPlace`) this file draws
 * from, at the bird's distance, so the picture and the hitbox cannot drift apart. No outline. A hazard's mesh is hidden while none of its kind is on screen (usually nothing is drawn); nothing is
 * allocated per frame. The harmless smoke is drawn behind the obstacles, the orbs and the bird, so it can never hide anything that matters.
 * The atlas is downloaded ATLAS_LEAD metres before the first moment a hazard can be on screen (see `lazyAtlas.js`), and a hazard is drawn only once it has loaded.
 */
const MAX = 2;
const ATLAS_URL = `${import.meta.env?.BASE_URL ?? '/'}images/hazards/hazards.webp`;
const CELLS = Object.keys(ATLAS);
/** A hazard is drawn from 90 m before its encounter (the cull below), so none can be on screen before this distance; the download starts ATLAS_LEAD m earlier. */
const LOAD_AT = Math.max(0, SLOTS[0].e - 90 - ATLAS_LEAD);

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

  const atlas = useMemo(
    () =>
      createLazyAtlas(
        ATLAS_URL,
        (tex) => {
          material.map = tex;
          material.needsUpdate = true;
          loaded.current = true;
        },
        () => console.warn('Fire Flipper: the flying-hazard picture could not be loaded; flying hazards are switched off for this session so that none can hurt you unseen.'),
      ),
    [material],
  );

  useEffect(
    () => () => {
      loaded.current = false;
      FLIERS.unseen = false; // leaving the game: the next simulation starts from the default
      atlas.dispose();
      material.dispose();
      geometries.forEach((g) => g.dispose());
    },
    [atlas, material, geometries],
  );

  useFrame(() => {
    const dist = sim.renderDistance();
    FLIERS.unseen = atlas.state !== 'loaded'; // fail-open: a hazard whose picture is not on screen cannot hurt the bird (a failed load stays this way for the session)
    if (FLIERS.enabled && dist >= LOAD_AT) atlas.request(); // once: later calls do nothing (and nothing is downloaded with ?fliers=0)
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
        // Every hazard is alive (all functions of the distance and the hazard's own place, so a pause freezes them and a retry replays them; looks only, the hitbox never moves):
        // the disc spins fast and throbs, the rings spin and flicker like flames/sparks, the tornado twists (sways, squeezes and stretches), the crystal burst tilts and pulses.
        const t = dist + sl.e * 0.37;
        let rot;
        let sx;
        let sy;
        if (sl.kind === 'disc') {
          rot = dist * 1.4;
          sx = sy = 1 + Math.sin(t * 1.3) * 0.03;
        } else if (sl.kind === 'tornado') {
          rot = Math.sin(t * 0.45) * 0.1;
          sx = 1 + Math.sin(t * 0.9) * 0.1;
          sy = 1 - Math.sin(t * 0.9) * 0.05 + Math.sin(t * 2.3) * 0.02;
        } else if (harmless) {
          rot = Math.sin(t * 0.16) * 0.09;
          sx = 1 + Math.sin(t * 0.55) * 0.06;
          sy = 1 + Math.sin(t * 0.55 + 1.2) * 0.05;
        } else {
          rot = dist * (sl.kind === 'firering' ? 0.5 : -0.7); // the swirl turns (the energy ring the other way)
          sx = sy = 1 + Math.sin(t * 2.1) * 0.025 + Math.sin(t * 3.7 + 1) * 0.015; // flicker
        }
        dummy.rotation.set(0, 0, rot);
        dummy.scale.set(sx, sy, 1);
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
