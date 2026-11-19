import { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import * as M from '../components/scene/animalModels.js';
import { createCanyonRockSet } from '../components/scene/canyonRocks.js';

/** Dev-only page (npm run dev, then /gallery.html): every zone obstacle model side by side for a close look. Not part of the build. */
const SUND = [['Tiger', 'createTiger', 0], ['Crocodile', 'createCrocodile', 0], ['Bat', 'createFruitBat', 1], ['Hive', 'createHoneyHive', 1], ['Swarm', 'createBeeSwarm', 1], ['Stilt roots', 'createStiltRoots', 0]];
const AMAZON = [['Toucan', 'createToucan', 0], ['Buttress', 'createButtress', 0], ['Boa', 'createTreeBoa', 1], ['Jaguar', 'createJaguar', 0], ['Anaconda', 'createAnaconda', 0], ['Sloth', 'createSloth', 1], ['Morpho', 'createMorpho', 0]];
const only = new URLSearchParams(location.search).get('only');
const all = new URLSearchParams(location.search).get('set') === 'amazon' ? AMAZON : SUND;
const which = only ? all.filter(([, fn]) => fn === only) : all;
const gaps = { createCrocodile: 4.6, createAnaconda: 5.4, createTiger: 3.2, createJaguar: 3.0 };

function Models() {
  let x = 0;
  const items = which.map(([name, fn, hang]) => {
    const w = gaps[fn] ?? 2.0;
    const at = x + w / 2;
    x += w + 0.6;
    return { name, fn, hang, at };
  });
  const total = x;
  return (
    <group position={[-total / 2, 0, 0]}>
      {items.map(({ fn, hang, at }) => (
        <mesh key={fn} geometry={M[fn]()} position={[at, hang ? 1.6 : -0.9, 0]}>
          <meshStandardMaterial vertexColors flatShading roughness={0.9} side={2} />
        </mesh>
      ))}
    </group>
  );
}

/** ?set=canyon: the canyon rock obstacle families as the game will draw them: hoodoo (shaft + cap), fin, arch lintel, passage slab, boulder. */
function CanyonRocks() {
  const g = useMemo(() => createCanyonRockSet(), []);
  const mat = <meshStandardMaterial vertexColors flatShading roughness={0.85} />;
  const H = 4.2;
  const W = 1.5;
  return (
    <group position={[-6.4, -2.6, 0]}>
      <group position={[0, H / 2, 0]}>
        <mesh geometry={g.hoodooShaft} scale={[W, H, W]}>{mat}</mesh>
        <mesh geometry={g.hoodooCap} scale={[W, W, W]} position={[0, H / 2, 0]}>{mat}</mesh>
      </group>
      <mesh geometry={g.fin} scale={[W, H, W]} position={[3, H / 2, 0]}>{mat}</mesh>
      <mesh geometry={g.lintel} scale={[W * 1.2, H, W * 1.2]} position={[6, H / 2, 0]} rotation={[0, 0, Math.PI]}>{mat}</mesh>
      <mesh geometry={g.slab} scale={[5.5, 2.6, 2.2]} position={[10.2, 1.3, 0]}>{mat}</mesh>
      <mesh geometry={g.boulder} scale={[1.2, 1.2, 1.2]} position={[14, 1.2, 0]}>{mat}</mesh>
    </group>
  );
}

createRoot(document.getElementById('root')).render(
  <Canvas camera={{ position: [Number(new URLSearchParams(location.search).get('cx') ?? 0), 0.4, Number(new URLSearchParams(location.search).get('z') ?? 14)], fov: 42 }} gl={{ preserveDrawingBuffer: true }}>
    <color attach="background" args={[new URLSearchParams(location.search).get('set') === 'canyon' ? '#d98a8a' : '#7fbf9a']} />
    <ambientLight intensity={0.9} />
    <directionalLight position={[3, 6, 8]} intensity={1.6} />
    {new URLSearchParams(location.search).get('set') === 'canyon' ? <CanyonRocks /> : <Models />}
  </Canvas>,
);
