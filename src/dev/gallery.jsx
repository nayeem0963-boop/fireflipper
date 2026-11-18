import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import * as M from '../components/scene/animalModels.js';

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

createRoot(document.getElementById('root')).render(
  <Canvas camera={{ position: [Number(new URLSearchParams(location.search).get('cx') ?? 0), 0.4, Number(new URLSearchParams(location.search).get('z') ?? 14)], fov: 42 }} gl={{ preserveDrawingBuffer: true }}>
    <color attach="background" args={['#7fbf9a']} />
    <ambientLight intensity={0.9} />
    <directionalLight position={[3, 6, 8]} intensity={1.6} />
    <Models />
  </Canvas>,
);
