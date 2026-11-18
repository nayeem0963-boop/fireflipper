import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { WORLD } from '../../systems/physics/constants.js';
import { envState, environmentAt } from '../../systems/world/environments.js';
import { useRenderSettings } from '../../hooks/useRenderSettings.js';
import { createGroundTexture } from './valleyTextures.js';
import Sky from './Sky.jsx';
import { CliffLayer, CloudLayer, IslandLayer, PeakLayer, TreeLayer } from './Scenery.jsx';

/**
 * Scenery for the whole journey. Everything scrolls from the simulation's distance, so the world
 * moves in lock-step with obstacles:
 *  - sky: a four-colour gradient computed in a tiny shader (blends between environments)
 *  - ground: one tiling texture scrolled by UV offset, tinted per environment
 *  - parallax layers for each environment's scenery (see Scenery.jsx), all instanced; layers whose
 *    environment is not currently standing are hidden and cost nothing
 * Low-power devices get fewer of everything.
 */
const GROUND_WIDTH = 200;
const GROUND_REPEAT = 50; // → 4 world units per tile

export default function Backdrop({ sim }) {
  const { tier } = useRenderSettings();
  const k = tier === 'low' ? 0.6 : 1;
  const n = (base) => Math.max(4, Math.round(base * k));
  return (
    <>
      <Sky sim={sim} />
      {/* Volcanic peaks: the original three layers, now instanced */}
      <PeakLayer sim={sim} depth={-34} scale={8} count={n(14)} span={160} speedFactor={0.1} tone="a" seed={1} />
      <PeakLayer sim={sim} depth={-20} scale={5} count={n(14)} span={120} speedFactor={0.28} tone="b" seed={7} />
      <PeakLayer sim={sim} depth={-9} scale={2.6} count={n(12)} span={80} speedFactor={0.6} tone="c" seed={13} spire />
      {/* Rocky Canyon */}
      <CliffLayer sim={sim} depth={-26} scale={1.5} count={n(9)} span={150} speedFactor={0.12} tone="a" seed={21} />
      <CliffLayer sim={sim} depth={-13} scale={0.95} count={n(9)} span={100} speedFactor={0.34} tone="b" seed={33} />
      {/* Floating Islands */}
      <IslandLayer sim={sim} depth={-24} scale={1.7} count={n(9)} span={150} speedFactor={0.14} seed={41} yMin={2.5} yMax={9} />
      <IslandLayer sim={sim} depth={-12} scale={1.0} count={n(8)} span={96} speedFactor={0.4} seed={53} yMin={0.5} yMax={7.5} />
      {/* Burning Forest */}
      <TreeLayer sim={sim} depth={-20} scale={1.5} count={n(18)} span={140} speedFactor={0.22} seed={61} />
      <TreeLayer sim={sim} depth={-10} scale={1.0} count={n(14)} span={90} speedFactor={0.5} seed={77} />
      {/* Ash Storm */}
      <CloudLayer sim={sim} count={tier === 'low' ? 5 : 8} span={170} />
      <Ground sim={sim} />
    </>
  );
}

function Ground({ sim }) {
  const tex = useMemo(() => {
    const t = createGroundTexture();
    t.repeat.set(GROUND_REPEAT, 25);
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  const mesh = useRef();
  const mat = useRef();

  useFrame((state) => {
    const tileSize = GROUND_WIDTH / GROUND_REPEAT;
    const dist = sim.renderDistance();
    tex.offset.x = (dist / tileSize) % 1;
    // Keep the ground centred under the camera so its edges are never seen.
    if (mesh.current) mesh.current.position.x = state.camera.position.x;
    const g = environmentAt(dist, envState).ground;
    mat.current.color.setRGB(...g.color);
    mat.current.emissive.setRGB(...g.emissive);
    mat.current.emissiveIntensity = g.emissiveIntensity;
  });

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, WORLD.groundY, -30]}>
      <planeGeometry args={[GROUND_WIDTH, 100]} />
      <meshStandardMaterial ref={mat} map={tex} emissiveMap={tex} emissive="#ff6a1a" emissiveIntensity={0.45} roughness={0.9} />
    </mesh>
  );
}
