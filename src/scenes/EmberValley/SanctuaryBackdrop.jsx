import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { WORLD } from '../../systems/physics/constants.js';
import { BIOMES } from '../../systems/world/biomes.js';
import { WORLD_LENGTH } from '../../systems/world/worlds.js';
import { createCloudSeaTexture } from './valleyTextures.js';
import { createFloatingIsland } from './celestialGeometry.js';
import { DriftParticles } from './AmbientEffects.jsx';
import { GradientSky, LoopingPaintings, ParallaxLayer, WeightDriver } from './ZoneParts.jsx';

const Z = BIOMES.sanctuary;
const S = Z.scene;
const GROUND_WIDTH = 200;
const GROUND_REPEAT = 50; // 4 world units per tile

/**
 * The five Cloud Sanctuary paintings, in order: each is shown for 400 m from 8000 m, then the next, so the five fill the last world
 * (the looping code would repeat them if the run went on). All 16:9; the cloud sea in the lower part of each picture sits on the game's horizon (row 0.70).
 */
const FILES = ['sanctuary-dragon.jpg', 'sanctuary-cat.jpg', 'sanctuary-deer.jpg', 'sanctuary-tiger.jpg', 'sanctuary-clouds.jpg'];
const ASPECT = 1408 / 792;
/** Each painting is shown for an equal share of the world (400 m). */
const SECTION = WORLD_LENGTH / FILES.length;

/**
 * The Cloud Sanctuary scenery for the last world (8000 to 10000 m): the five paintings, 400 m each, a soft cloud-sea floor with golden glints, and small floating
 * islands at two depths. It cross-fades with the Rose Sky Palace (around 8000 m). Purely visual: nothing here touches the simulation.
 */
export default function SanctuaryBackdrop({ sim }) {
  const root = useRef();
  const wRef = useRef(0);
  const island = useMemo(() => createFloatingIsland(S), []);
  useEffect(() => () => island.dispose(), [island]);
  return (
    <group ref={root} name="sanctuary" visible={false}>
      <GradientSky wRef={wRef} top={S.skyTop} bottom={S.skyBottom} />
      <LoopingPaintings sim={sim} wRef={wRef} zone={Z} files={FILES} aspect={ASPECT} length={SECTION} />
      <Clouds sim={sim} wRef={wRef} />
      <ParallaxLayer sim={sim} wRef={wRef} geometry={island} depth={-30} scale={1.3} count={5} span={190} speedFactor={0.22} seed={61} tint="#ffffff" lift={[9, 24]} emissive="#ffd890" emissiveIntensity={0.45} growAll bob={0.4} />
      <ParallaxLayer sim={sim} wRef={wRef} geometry={island} depth={-18} scale={0.6} count={4} span={120} speedFactor={0.45} seed={74} tint="#ffffff" lift={[7, 15]} emissive="#ffd890" emissiveIntensity={0.45} growAll bob={0.3} />
      <DriftParticles sim={sim} wRef={wRef} zoneId="sanctuary" />
      <WeightDriver sim={sim} zone={Z} wRef={wRef} groupRef={root} />
    </group>
  );
}

/** The floor: a soft cloud sea, scrolled with the track, fading in with the zone. */
function Clouds({ sim, wRef }) {
  const mesh = useRef();
  const mat = useRef();
  const tex = useMemo(() => {
    const t = createCloudSeaTexture(S);
    t.repeat.set(GROUND_REPEAT, 25);
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame((state) => {
    tex.offset.x = (sim.renderDistance() / (GROUND_WIDTH / GROUND_REPEAT)) % 1;
    if (mesh.current) mesh.current.position.x = state.camera.position.x;
    if (mat.current) mat.current.opacity = Math.min(1, wRef.current * 2);
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, WORLD.groundY + 0.07, -30]}>
      <planeGeometry args={[GROUND_WIDTH, 100]} />
      <meshStandardMaterial ref={mat} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.6} roughness={0.9} transparent depthWrite={false} />
    </mesh>
  );
}
