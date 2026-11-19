import { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import * as M from '../components/scene/animalModels.js';
import { createCanyonRockSet, poleInstances } from '../components/scene/canyonRocks.js';

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

/** ?set=canyon: the canyon rock obstacles as the game will place them (poleInstances, the same placement list the tests assemble): a hoodoo and a fin rising from the ground, a fin and a lintel hanging, an arch span, a ledge and boulders. */
function CanyonRocks() {
  const g = useMemo(() => createCanyonRockSet(), []);
  const mat = <meshStandardMaterial vertexColors flatShading roughness={0.85} />;
  const floorY = -3.2;
  const W = 1.5;
  const pole = (look, cap, x, gapEndY) => {
    const dDraw = Math.abs(gapEndY - (cap > 0 ? floorY - 0.5 : 5.4)) / W;
    return poleInstances(look, cap, gapEndY, W, dDraw).map((it, i) => <mesh key={`${look}${cap}${x}${i}`} geometry={g[it.key]} position={[x, it.y, 0]} scale={[it.s, it.sy, it.s]}>{mat}</mesh>);
  };
  const L = 7;
  return (
    <group>
      {pole('hoodoo', 1, -9, 0.2)}
      {pole('fin', 1, -6, 0.2)}
      {pole('fin', -1, -3, -0.4)}
      {pole('lintel', -1, 0, -0.4)}
      {/* a passage: ledge below, arch span above, the gap between (gap height 0 to 3) */}
      <group position={[7.5, 0, 0]}>
        <mesh geometry={g.archBand} position={[0, 3, 0]} scale={[L, 1, 2.2]}>{mat}</mesh>
        <mesh geometry={g.slabBody} position={[0, 3 + 1.2 + 2.2, 0]} scale={[L, 4.4, 2.2]}>{mat}</mesh>
        <mesh geometry={g.ledgeBand} position={[0, 0, 0]} scale={[L, 1, 2.2]}>{mat}</mesh>
        <mesh geometry={g.slabBody} position={[0, -1.2 - 1.0, 0]} scale={[L, 2, 2.2]}>{mat}</mesh>
      </group>
      <mesh geometry={g.boulder} position={[13.5, -2, 0]} scale={[1.2, 1.2, 1.2]}>{mat}</mesh>
      <mesh geometry={g.boulder} position={[15.6, -2.6, 0]} scale={[0.7, 0.7, 0.7]} rotation={[0.5, 1, 0]}>{mat}</mesh>
      <mesh position={[0, floorY - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[60, 6]} /><meshStandardMaterial color="#c8603a" /></mesh>
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
