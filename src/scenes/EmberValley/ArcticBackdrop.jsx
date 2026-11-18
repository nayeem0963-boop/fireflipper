import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { WORLD } from '../../systems/physics/constants.js';
import { BIOMES } from '../../systems/world/biomes.js';
import { createSnowTexture } from './valleyTextures.js';
import { createIceCrystals, createSnowOutcrops } from './arcticGeometry.js';
import { AuroraShimmer, DriftParticles } from './AmbientEffects.jsx';
import { GradientSky, ParallaxLayer, PaintedHorizon, WeightDriver } from './ZoneParts.jsx';

const Z = BIOMES.arctic;
const S = Z.scene;
const GROUND_WIDTH = 200;
const GROUND_REPEAT = 50; // 4 world units per tile
/**
 * The three Frosty Polar paintings, one per sub-scene: Glacier Valley (1500 to 1665 m), Crystal Ice Canyon (1665 to 1830 m) and Aurora Lake (1830 to 2000 m).
 * Each is a whole 16:9 scene; `horizon` is the row of the picture (from its top) where the far shore meets the lake, which sits on the game's horizon line (the 3D
 * snow floor takes over below it). Each loads about 150 m before it is needed (`loadAt`).
 */
const PAINTINGS = [
  { file: 'frosty-glacier-valley.jpg', aspect: 1408 / 792, horizon: 0.63, loadAt: 1350 },
  { file: 'frosty-crystal-canyon.jpg', aspect: 1408 / 792, horizon: 0.65, loadAt: 1515 },
  { file: 'frosty-aurora-lake.jpg', aspect: 1408 / 792, horizon: 0.5, loadAt: 1680 },
];
/** Where each next sub-scene dissolves in over the one before it (metres), over DISSOLVE metres centred on the cut. */
const CUTS = [1665, 1830];
const DISSOLVE = 40;
const RISE = { from: 0.66, to: 0.66, cover: 1.5 };
const FADE_RGB = [176, 196, 238];

/**
 * The Frosty Polar scenery for 1500 to 2000 m: the three Frosty paintings (public/images/backdrop) slide with the run distance and dissolve into each other at
 * 1665 and 1830 m, with a faceted snowfield, slate outcrops and ice crystals in 3D for depth and parallax. It cross-fades with the canyon (around 1500 m) and with the
 * Celestial City (around 2000 m), and is hidden outside that, so it costs nothing elsewhere. Purely visual: nothing here touches the simulation.
 */
export default function ArcticBackdrop({ sim }) {
  const root = useRef();
  const wRef = useRef(0);
  const outcrops = useMemo(() => createSnowOutcrops(S.rock), []);
  const crystals = useMemo(() => createIceCrystals(), []);
  useEffect(
    () => () => {
      outcrops.dispose();
      crystals.dispose();
    },
    [outcrops, crystals],
  );
  return (
    <group ref={root} name="arctic" visible={false}>
      <GradientSky wRef={wRef} top={S.skyTop} bottom={S.skyMid} />
      <PaintedHorizon sim={sim} wRef={wRef} zone={Z} paintings={PAINTINGS} cuts={CUTS} dissolve={DISSOLVE} preloadAt={1350} fadeRgb={FADE_RGB} rise={RISE} depth />
      <Snow sim={sim} wRef={wRef} />
      <ParallaxLayer sim={sim} wRef={wRef} geometry={crystals} depth={-26} scale={1.5} count={5} span={140} speedFactor={0.32} seed={9} tint="#ffffff" emissive="#6fd0f0" emissiveIntensity={0.55} />
      <ParallaxLayer sim={sim} wRef={wRef} geometry={outcrops} depth={-34} scale={2.4} count={7} span={170} speedFactor={0.22} seed={6} tint="#dfe6ea" />
      <ParallaxLayer sim={sim} wRef={wRef} geometry={outcrops} depth={-17} scale={0.95} count={5} span={104} speedFactor={0.55} seed={14} tint="#ffffff" />
      <AuroraShimmer sim={sim} wRef={wRef} />
      <DriftParticles sim={sim} wRef={wRef} zoneId="arctic" />
      <WeightDriver sim={sim} zone={Z} wRef={wRef} groupRef={root} />
    </group>
  );
}

/** The snowfield: a faceted white-blue floor, scrolled with the track, fading in with the zone. */
function Snow({ sim, wRef }) {
  const mesh = useRef();
  const mat = useRef();
  const tex = useMemo(() => {
    const t = createSnowTexture(S);
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
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, WORLD.groundY + 0.05, -30]}>
      <planeGeometry args={[GROUND_WIDTH, 100]} />
      <meshStandardMaterial ref={mat} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.5} roughness={0.9} transparent depthWrite={false} />
    </mesh>
  );
}
