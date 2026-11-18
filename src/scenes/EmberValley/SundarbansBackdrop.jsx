import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DoubleSide, Object3D } from 'three';
import { WORLD } from '../../systems/physics/constants.js';
import { BIOMES, biomeWeight } from '../../systems/world/biomes.js';
import { createSundarbansGroundTexture } from './valleyTextures.js';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { createMangroveGeometry, createPneumatophoreGeometry, createTuftGeometry } from './mangroveGeometry.js';

const S = BIOMES.sundarbans.scene;
const GROUND_WIDTH = 200;
const GROUND_REPEAT = 50; // 4 world units per tile, like the original ground

/** Deterministic pseudo-random so layouts are stable across renders. */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * The Sundarbans scenery for the first 500 m: sky, three parallax layers of mangroves, the tidal-water floor with a
 * mud bank, breathing-root spikes and grass tufts. Everything is instanced (about 7 draw calls), scrolls from the
 * simulation's distance like the rest of the world, and is purely visual. It fades out between 420 and 500 m: the
 * trees sink below the horizon (scale to zero) while the mountains rise, so there is no pop. After 500 m nothing
 * here renders at all.
 */
export default function SundarbansBackdrop({ sim }) {
  const root = useRef();
  const wRef = useRef(1);
  return (
    <group ref={root} name="sundarbans">
      <Sky wRef={wRef} />
      <Water sim={sim} wRef={wRef} />
      <TreeLayer sim={sim} wRef={wRef} depth={-34} scale={8.5} count={18} span={160} speedFactor={0.1} seed={3} tint="#7fa08c" variant={0} />
      <TreeLayer sim={sim} wRef={wRef} depth={-20} scale={5} count={15} span={120} speedFactor={0.28} seed={11} tint="#a9c4ae" variant={1} />
      <TreeLayer sim={sim} wRef={wRef} depth={-9} scale={2.9} count={11} span={80} speedFactor={0.6} seed={19} tint="#ffffff" variant={2} />
      <Spikes sim={sim} wRef={wRef} />
      <WeightDriver sim={sim} wRef={wRef} groupRef={root} />
    </group>
  );
}

/** Computes the fade weight once per frame for every layer, and hides the whole zone once it is gone. */
function WeightDriver({ sim, wRef, groupRef }) {
  useFrame(() => {
    const w = biomeWeight(sim.renderDistance());
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

function Water({ sim, wRef }) {
  const mesh = useRef();
  const mat = useRef();
  const tex = useMemo(() => {
    const t = createSundarbansGroundTexture(S);
    t.repeat.set(GROUND_REPEAT, 1);
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame((state) => {
    const tileSize = GROUND_WIDTH / GROUND_REPEAT;
    tex.offset.x = (sim.renderDistance() / tileSize) % 1;
    if (mesh.current) mesh.current.position.x = state.camera.position.x;
    if (mat.current) mat.current.opacity = Math.min(1, wRef.current * 1.6);
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, WORLD.groundY + 0.02, -30]}>
      <planeGeometry args={[GROUND_WIDTH, 100]} />
      <meshStandardMaterial ref={mat} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.5} roughness={0.55} metalness={0.05} transparent depthWrite={false} />
    </mesh>
  );
}

function TreeLayer({ sim, wRef, depth, scale, count, span, speedFactor, seed, tint, variant }) {
  const mesh = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const geometry = useMemo(() => createMangroveGeometry(variant), [variant]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const trees = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: count }, (_, i) => ({
      x: (i / count) * span - span / 2 + rand() * (span / count) * 0.7,
      s: scale * (0.7 + rand() * 0.7),
      dz: (rand() - 0.5) * 3,
      rot: rand() * Math.PI * 2,
      shade: 0.82 + rand() * 0.3,
    }));
  }, [count, scale, seed, span]);
  // per-instance colour: a slight brightness variation, multiplied with the haze tint for the far layers
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
    const w = wRef.current;
    const camX = state.camera.position.x;
    const offset = (sim.renderDistance() * speedFactor) % span;
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      let x = t.x - offset;
      if (x < -span / 2) x += span;
      dummy.position.set(x + camX, WORLD.groundY, t.dz);
      dummy.rotation.set(0, t.rot, 0);
      // sinks into the water as the zone fades out
      const grow = Math.max(0.0001, w);
      dummy.scale.set(t.s, t.s * grow, t.s);
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

/** Breathing-root spikes and grass tufts on the far mud bank: the low foliage that makes the floor read as a delta. */
function Spikes({ sim, wRef }) {
  const spikes = useRef();
  const tufts = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const spikeGeo = useMemo(createPneumatophoreGeometry, []);
  const tuftGeo = useMemo(createTuftGeometry, []);
  useEffect(
    () => () => {
      spikeGeo.dispose();
      tuftGeo.dispose();
    },
    [spikeGeo, tuftGeo],
  );
  const SPAN = 100;
  const items = useMemo(() => {
    const rand = seeded(41);
    return {
      spikes: Array.from({ length: 90 }, () => ({ x: rand() * SPAN - SPAN / 2, z: -27 + rand() * 5.5, s: 0.25 + rand() * 0.45 })),
      tufts: Array.from({ length: 28 }, () => ({ x: rand() * SPAN - SPAN / 2, z: -26 + rand() * 6, s: 0.5 + rand() * 0.8, rot: rand() * 3 })),
    };
  }, []);

  useFrame((state) => {
    const w = wRef.current;
    const dist = sim.renderDistance();
    const camX = state.camera.position.x;
    const grow = Math.max(0.0001, w);
    const write = (mesh, list, rotates) => {
      if (!mesh) return;
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        let x = it.x - (dist % SPAN);
        if (x < -SPAN / 2) x += SPAN;
        dummy.position.set(x + camX, WORLD.groundY, it.z);
        dummy.rotation.set(0, rotates ? it.rot : 0, 0);
        dummy.scale.set(it.s, it.s * grow, it.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    write(spikes.current, items.spikes, false);
    write(tufts.current, items.tufts, true);
  });

  return (
    <>
      <instancedMesh ref={spikes} args={[undefined, undefined, items.spikes.length]} frustumCulled={false}>
        <primitive object={spikeGeo} attach="geometry" />
        <meshStandardMaterial vertexColors flatShading roughness={1} side={DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={tufts} args={[undefined, undefined, items.tufts.length]} frustumCulled={false}>
        <primitive object={tuftGeo} attach="geometry" />
        <meshStandardMaterial vertexColors flatShading roughness={1} side={DoubleSide} />
      </instancedMesh>
    </>
  );
}
