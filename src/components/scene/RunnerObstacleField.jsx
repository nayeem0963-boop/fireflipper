import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RUN } from '../../systems/runner/constants.js';
import { worldIndexAt } from '../../systems/world/worlds.js';

/**
 * The ground-runner's obstacles (v2), drawn from the runner simulation's pooled records: low rocks, ice spikes and fallen logs she jumps,
 * and pits (crevasses) in the land she jumps across. Each look is ONE InstancedMesh, so the whole field is a handful of draw calls however
 * many are alive; matrices are rewritten from simulation data each frame and nothing is allocated per frame. Looks only: what hurts her is
 * the record's collider (box) or the land giving way (a pit), never these shapes.
 *
 * Every obstacle takes the colours of the world it stands in (by its own track position), so a rock in the canyon is red sandstone and the same
 * rock in the Frosty Polar is pale blue stone.
 */
const MAX = { rock: 24, ice: 24, log: 16, pit: 8 };
const DEPTH = 1.5; // how deep (along z) the solid obstacles are drawn
const PIT_DEPTH = 11; // how far a pit reaches into the scene (z): it must cover the visible floor from the camera

/** Colours per world (canyon, arctic, celestial, palace, sanctuary): rock, ice, log, and the glow around a pit. */
const PALETTE = [
  { rock: '#9a5535', ice: '#e8854a', log: '#5a3a24', rim: '#ff7a2a' },
  { rock: '#9db3c9', ice: '#c4efff', log: '#6d5b4b', rim: '#7fd6ff' },
  { rock: '#6e5fae', ice: '#b1bdff', log: '#4a3c7c', rim: '#9a8aff' },
  { rock: '#b4698d', ice: '#ffc4de', log: '#7d4c65', rim: '#ff8cbf' },
  { rock: '#d9ccae', ice: '#fff3cc', log: '#a99262', rim: '#ffd37a' },
].map((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, new Color(v)])));

/** A crystal cluster: one tall spike with two smaller ones leaning against it. Unit sized: 1 wide, 1 tall. */
function iceGeometry() {
  const spike = (r, h, x, z) => {
    const g = new ConeGeometry(r, h, 5);
    g.translate(x, h / 2, z);
    return g;
  };
  return mergeGeometries([spike(0.5, 1, 0, 0), spike(0.28, 0.62, 0.34, 0.12), spike(0.22, 0.5, -0.32, -0.1)]);
}

export default function RunnerObstacleField({ sim }) {
  const dummy = useMemo(() => new Object3D(), []);
  const parts = useMemo(() => {
    const rockGeo = new IcosahedronGeometry(0.5, 0);
    const iceGeo = iceGeometry();
    const logGeo = new CylinderGeometry(0.5, 0.5, 1, 10);
    logGeo.rotateZ(Math.PI / 2); // lying along the track
    const pitGeo = new PlaneGeometry(1, 1);
    pitGeo.rotateX(-Math.PI / 2);
    // (no emissive on the stone and wood: they take their colour from the world's palette, and a white glow would wash it to grey)
    const solid = () => new MeshStandardMaterial({ flatShading: true, roughness: 0.9 });
    return {
      rock: { geo: rockGeo, mat: solid() },
      ice: { geo: iceGeo, mat: new MeshStandardMaterial({ flatShading: true, roughness: 0.25, metalness: 0.1, emissive: new Color('#9fdcff'), emissiveIntensity: 0.35 }) },
      log: { geo: logGeo, mat: solid() },
      pitDark: { geo: pitGeo, mat: new MeshBasicMaterial({ color: '#04060c', toneMapped: false, side: DoubleSide }) },
      pitRim: { geo: pitGeo, mat: new MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true, opacity: 0.9, side: DoubleSide }) },
    };
  }, []);

  const meshes = useRef({});
  const created = useMemo(() => {
    const m = {};
    for (const [name, max] of [['rock', MAX.rock], ['ice', MAX.ice], ['log', MAX.log], ['pitDark', MAX.pit], ['pitRim', MAX.pit]]) {
      const mesh = new InstancedMesh(parts[name].geo, parts[name].mat, max);
      mesh.frustumCulled = false;
      mesh.count = 0;
      m[name] = mesh;
    }
    return m;
  }, [parts]);
  meshes.current = created;

  useEffect(
    () => () => {
      Object.values(parts).forEach((p) => {
        p.geo.dispose();
        p.mat.dispose();
      });
      Object.values(created).forEach((m) => m.dispose());
    },
    [parts, created],
  );

  const tint = useMemo(() => new Color(), []);

  useFrame(() => {
    const dist = sim.renderDistance();
    const n = { rock: 0, ice: 0, log: 0, pit: 0 };
    for (const o of sim.obstacles.active) {
      const x = o.x - dist;
      if (x < -16 || x > 60) continue;
      const pal = PALETTE[worldIndexAt(o.x)];
      if (o.kind === 'pit') {
        const i = n.pit++;
        if (i >= MAX.pit) continue;
        const y = RUN.groundY + 0.1;
        dummy.rotation.set(0, 0, 0);
        dummy.position.set(x, y - 0.012, -PIT_DEPTH / 2 + 1);
        dummy.scale.set(o.w + 0.42, 1, PIT_DEPTH);
        dummy.updateMatrix();
        created.pitRim.setMatrixAt(i, dummy.matrix);
        created.pitRim.setColorAt(i, pal.rim);
        dummy.position.set(x, y, -PIT_DEPTH / 2 + 1);
        dummy.scale.set(o.w - 0.1, 1, PIT_DEPTH - 0.3);
        dummy.updateMatrix();
        created.pitDark.setMatrixAt(i, dummy.matrix);
        continue;
      }
      const look = o.look;
      const i = n[look]++;
      if (i >= MAX[look]) continue;
      const mesh = created[look];
      dummy.rotation.set(0, o.rot, 0);
      if (look === 'rock') {
        // a chunky boulder, wider and taller than its collider so it reads beside her (the drawing is bigger than what hurts, never smaller)
        dummy.position.set(x, RUN.groundY + o.h * 0.5, o.z);
        dummy.scale.set(o.w * 1.35 * o.sx, o.h * 1.3 * o.sy, DEPTH * 1.2 * o.sz);
        tint.copy(pal.rock);
      } else if (look === 'ice') {
        dummy.position.set(x, RUN.groundY - 0.02, o.z);
        dummy.scale.set(o.w * 1.6, o.h * 1.18 * o.sy, DEPTH * 0.9 * o.sz);
        tint.copy(pal.ice);
      } else {
        dummy.rotation.set(0, o.rot * 0.15, 0);
        dummy.position.set(x, RUN.groundY + o.h * 0.55, o.z);
        dummy.scale.set(o.w * 1.08, o.h * 1.2, o.h * 1.4 * o.sz);
        tint.copy(pal.log);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, tint);
    }
    for (const [name, key] of [['rock', 'rock'], ['ice', 'ice'], ['log', 'log']]) {
      const mesh = created[name];
      mesh.count = Math.min(n[key], MAX[key]);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    for (const name of ['pitDark', 'pitRim']) {
      const mesh = created[name];
      mesh.count = Math.min(n.pit, MAX.pit);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <primitive object={created.pitRim} />
      <primitive object={created.pitDark} />
      <primitive object={created.rock} />
      <primitive object={created.ice} />
      <primitive object={created.log} />
    </>
  );
}
