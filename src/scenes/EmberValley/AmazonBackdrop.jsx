import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, Color, DoubleSide, Object3D, SRGBColorSpace } from 'three';
import { WORLD } from '../../systems/physics/constants.js';
import { BIOMES, zoneWeight } from '../../systems/world/biomes.js';
import { createAmazonGroundTexture } from './valleyTextures.js';
import { createAmazonTreeGeometry, createFernGeometry, createLeafMassGeometry, createVineGeometry } from './amazonGeometry.js';
import { ConeGeometry } from 'three';

const Z = BIOMES.amazon;
const S = Z.scene;
const GROUND_WIDTH = 200;
const GROUND_REPEAT = 50; // 4 world units per tile, like the other floors

/** Deterministic pseudo-random so layouts are stable across renders. */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * The Amazon scenery for 1000 to 1500 m: a teal-green sky glimpsed through the canopy, three parallax layers of tall
 * rainforest trees, an overhead leaf canopy, a leaf-litter floor, ferns, hanging vines and soft light shafts.
 * Everything is instanced (about 9 draw calls), scrolls from the simulation's distance like the rest of the world and is
 * purely visual. It grows in over 1000 to 1080 m and sinks away over 1420 to 1500 m (trees scale to nothing while the
 * mountains rise), and the whole group is hidden outside the zone, so it costs nothing elsewhere.
 */
export default function AmazonBackdrop({ sim }) {
  const root = useRef();
  const wRef = useRef(0);
  return (
    <group ref={root} name="amazon" visible={false}>
      <Sky wRef={wRef} />
      <Floor sim={sim} wRef={wRef} />
      <TreeLayer sim={sim} wRef={wRef} depth={-36} height={15} width={1.6} count={22} span={170} speedFactor={0.1} seed={5} tint="#6f9a86" variant={0} />
      <TreeLayer sim={sim} wRef={wRef} depth={-22} height={12} width={1.4} count={18} span={130} speedFactor={0.28} seed={13} tint="#8fb59c" variant={1} />
      <TreeLayer sim={sim} wRef={wRef} depth={-11} height={9.5} width={1.1} count={12} span={90} speedFactor={0.6} seed={23} tint="#ffffff" variant={2} />
      <LeafCeiling sim={sim} wRef={wRef} />
      <Ferns sim={sim} wRef={wRef} />
      <Vines sim={sim} wRef={wRef} />
      <Shafts sim={sim} wRef={wRef} />
      <WeightDriver sim={sim} wRef={wRef} groupRef={root} />
    </group>
  );
}

function WeightDriver({ sim, wRef, groupRef }) {
  useFrame(() => {
    const w = zoneWeight(Z, sim.renderDistance());
    wRef.current = w;
    if (groupRef.current) groupRef.current.visible = w > 0.001;
  }, -1);
  return null;
}

function createSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, S.skyTop);
  g.addColorStop(0.7, S.skyBottom);
  g.addColorStop(1, S.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function Sky({ wRef }) {
  const mat = useRef();
  const tex = useMemo(createSkyTexture, []);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame(() => {
    if (mat.current) mat.current.opacity = Math.min(1, wRef.current * 1.4);
  });
  return (
    <mesh position={[0, 8, -58]} renderOrder={-2}>
      <planeGeometry args={[400, 60]} />
      <meshBasicMaterial ref={mat} map={tex} transparent fog={false} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

function Floor({ sim, wRef }) {
  const mesh = useRef();
  const mat = useRef();
  const tex = useMemo(() => {
    const t = createAmazonGroundTexture(S);
    t.repeat.set(GROUND_REPEAT, 25); // square 4 m tiles, so the litter is not stretched
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame((state) => {
    tex.offset.x = ((sim.renderDistance() / (GROUND_WIDTH / GROUND_REPEAT)) % 1);
    if (mesh.current) mesh.current.position.x = state.camera.position.x;
    if (mat.current) mat.current.opacity = Math.min(1, wRef.current * 1.6);
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, WORLD.groundY + 0.02, -30]}>
      <planeGeometry args={[GROUND_WIDTH, 100]} />
      <meshStandardMaterial ref={mat} map={tex} roughness={0.95} transparent depthWrite={false} />
    </mesh>
  );
}

function TreeLayer({ sim, wRef, depth, height, width, count, span, speedFactor, seed, tint, variant }) {
  const mesh = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const geometry = useMemo(() => createAmazonTreeGeometry(variant), [variant]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const trees = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: count }, (_, i) => ({
      x: (i / count) * span - span / 2 + rand() * (span / count) * 0.7,
      h: height * (0.75 + rand() * 0.5),
      w: width * (0.8 + rand() * 0.5),
      dz: (rand() - 0.5) * 3,
      rot: rand() * Math.PI * 2,
      shade: 0.8 + rand() * 0.3,
    }));
  }, [count, height, width, seed, span]);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const base = new Color(tint);
    const c = new Color();
    trees.forEach((t, i) => m.setColorAt(i, c.copy(base).multiplyScalar(t.shade)));
    m.instanceColor.needsUpdate = true;
  }, [trees, tint]);
  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const grow = Math.max(0.0001, wRef.current);
    const camX = state.camera.position.x;
    const offset = (sim.renderDistance() * speedFactor) % span;
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      let x = t.x - offset;
      if (x < -span / 2) x += span;
      dummy.position.set(x + camX, WORLD.groundY, t.dz);
      dummy.rotation.set(0, t.rot, 0);
      dummy.scale.set(t.w * 4.5, t.h * grow, t.w * 4.5);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <group position={[0, 0, depth]}>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial vertexColors flatShading roughness={1} />
      </instancedMesh>
    </group>
  );
}

/** Overhead leaf masses: the canopy that frames the top of the screen (behind the flight plane, so it never hides an obstacle). */
function LeafCeiling({ sim, wRef }) {
  const mesh = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const geometry = useMemo(createLeafMassGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const SPAN = 110;
  const items = useMemo(() => {
    const rand = seeded(77);
    return Array.from({ length: 22 }, (_, i) => ({
      x: (i / 22) * SPAN - SPAN / 2 + rand() * 3,
      y: 6.6 + rand() * 3.2,
      z: -6 - rand() * 12,
      s: 2.6 + rand() * 2.6,
      rot: rand() * 3,
    }));
  }, []);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new Color();
    items.forEach((it, i) => m.setColorAt(i, c.set('#ffffff').multiplyScalar(0.75 + (i % 5) * 0.07)));
    m.instanceColor.needsUpdate = true;
  }, [items]);
  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const grow = Math.max(0.0001, wRef.current);
    const camX = state.camera.position.x;
    const offset = (sim.renderDistance() * 0.5) % SPAN;
    items.forEach((it, i) => {
      let x = it.x - offset;
      if (x < -SPAN / 2) x += SPAN;
      // lifts away upwards when the zone ends
      dummy.position.set(x + camX, it.y + (1 - grow) * 6, it.z);
      dummy.rotation.set(0, it.rot, 0);
      dummy.scale.set(it.s, it.s * 0.9 * grow, it.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, items.length]} frustumCulled={false}>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial vertexColors flatShading roughness={1} />
    </instancedMesh>
  );
}

function Ferns({ sim, wRef }) {
  const mesh = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const geometry = useMemo(createFernGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const SPAN = 100;
  const items = useMemo(() => {
    const rand = seeded(91);
    return Array.from({ length: 46 }, () => ({ x: rand() * SPAN - SPAN / 2, z: -16 + rand() * 10, s: 0.9 + rand() * 1.1, rot: rand() * 3 }));
  }, []);
  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const grow = Math.max(0.0001, wRef.current);
    const dist = sim.renderDistance();
    const camX = state.camera.position.x;
    items.forEach((it, i) => {
      let x = it.x - (dist % SPAN);
      if (x < -SPAN / 2) x += SPAN;
      dummy.position.set(x + camX, WORLD.groundY, it.z);
      dummy.rotation.set(0, it.rot, 0);
      dummy.scale.set(it.s, it.s * grow, it.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, items.length]} frustumCulled={false}>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial vertexColors flatShading roughness={1} side={DoubleSide} />
    </instancedMesh>
  );
}

/** Thin hanging vines that sway a little, behind the flight plane. */
function Vines({ sim, wRef }) {
  const mesh = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const geometry = useMemo(createVineGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const SPAN = 90;
  const items = useMemo(() => {
    const rand = seeded(133);
    return Array.from({ length: 22 }, () => ({ x: rand() * SPAN - SPAN / 2, z: -5 - rand() * 9, len: 4 + rand() * 6, ph: rand() * 6 }));
  }, []);
  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const grow = Math.max(0.0001, wRef.current);
    const camX = state.camera.position.x;
    const t = state.clock.elapsedTime;
    const offset = (sim.renderDistance() * 0.6) % SPAN;
    items.forEach((it, i) => {
      let x = it.x - offset;
      if (x < -SPAN / 2) x += SPAN;
      dummy.position.set(x + camX, 8.6, it.z);
      dummy.rotation.set(0, 0, Math.sin(t * 0.8 + it.ph) * 0.05);
      dummy.scale.set(1, it.len * grow, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, items.length]} frustumCulled={false}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial vertexColors fog />
    </instancedMesh>
  );
}

/** Soft light shafts slanting down through the canopy. */
function Shafts({ sim, wRef }) {
  const mesh = useRef();
  const mat = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const geometry = useMemo(() => new ConeGeometry(0.9, 1, 7, 1, true), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const SPAN = 100;
  const items = useMemo(() => {
    const rand = seeded(211);
    return Array.from({ length: 7 }, (_, i) => ({ x: (i / 7) * SPAN - SPAN / 2 + rand() * 6, z: -14 - rand() * 8, tilt: 0.18 + rand() * 0.12 }));
  }, []);
  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const camX = state.camera.position.x;
    const offset = (sim.renderDistance() * 0.4) % SPAN;
    items.forEach((it, i) => {
      let x = it.x - offset;
      if (x < -SPAN / 2) x += SPAN;
      dummy.position.set(x + camX, 4.2, it.z);
      dummy.rotation.set(0, 0, it.tilt);
      dummy.scale.set(2.2, 13, 2.2);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    if (mat.current) mat.current.opacity = 0.07 * wRef.current;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, items.length]} frustumCulled={false} renderOrder={1}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial ref={mat} color={S.shaft} transparent opacity={0} depthWrite={false} side={DoubleSide} fog={false} />
    </instancedMesh>
  );
}
