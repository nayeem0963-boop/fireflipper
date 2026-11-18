import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { WORLD } from '../../systems/physics/constants.js';
import { BIOMES } from '../../systems/world/biomes.js';
import { createCanyonFloorTexture } from './valleyTextures.js';
import { createCanyonMesas } from './mangroveGeometry.js';
import { DriftParticles } from './AmbientEffects.jsx';
import { GradientSky, ParallaxLayer, PaintedHorizon, WeightDriver } from './ZoneParts.jsx';

const Z = BIOMES.canyon;
const S = Z.scene;
const GROUND_WIDTH = 200;
const GROUND_REPEAT = 50; // 4 world units per tile
/**
 * The three canyon paintings, one for each 500 m of the first 1500 m (an arch and a misty gorge; pillars and a natural bridge in the low sun; a winding river
 * canyon at sunset). `horizon` is the row of each picture (from the top) that sits on the horizon line: the valley floor, so the cliffs, arches and sunset sky fill the
 * view above it and the 3D canyon floor takes over below it. Only the first loads at start-up; the others load as the player approaches them (`loadAt`).
 */
const PAINTINGS = [
  { file: 'canyon-a.jpg', aspect: 1280 / 720, horizon: 0.66, loadAt: -1 },
  { file: 'canyon-b.jpg', aspect: 1280 / 720, horizon: 0.66, loadAt: 250 },
  { file: 'canyon-c.jpg', aspect: 1280 / 720, horizon: 0.66, loadAt: 750 },
];
/** Where each next painting dissolves in over the one before it (metres): one painting per 500 m. */
const CUTS = [500, 1000];
const DISSOLVE = 60;
/** The picture is scaled to about 1.55 times the visible height, so the valley floor can sit on the horizon with sky above it. */
const RISE = { from: 0.66, to: 0.66, cover: 1.55 };
const FADE_RGB = [172, 90, 91];

/**
 * The Red Rock Canyon scenery for 0 to 1500 m: the three canyon paintings (public/images/backdrop) fill the sky and drift slowly sideways as you fly, one for
 * each 500 m; a dusty faceted canyon floor takes over at the horizon, and red sandstone mesas stand at two depths for parallax. It cross-fades into the Arctic around
 * 1500 m, and is hidden once that is done, so it costs nothing elsewhere. Purely visual: nothing here touches the simulation.
 */
export default function CanyonBackdrop({ sim }) {
  const root = useRef();
  const wRef = useRef(1);
  const mesas = useMemo(() => createCanyonMesas(S.mesa), []);
  useEffect(() => () => mesas.dispose(), [mesas]);
  return (
    <group ref={root} name="canyon">
      <GradientSky wRef={wRef} top={S.skyTop} bottom={S.skyBottom} />
      <PaintedHorizon sim={sim} wRef={wRef} zone={Z} paintings={PAINTINGS} cuts={CUTS} dissolve={DISSOLVE} preloadAt={0} fadeRgb={FADE_RGB} rise={RISE} depth />
      <Floor sim={sim} wRef={wRef} />
      <ParallaxLayer sim={sim} wRef={wRef} geometry={mesas} depth={-34} scale={1.7} count={5} span={190} speedFactor={0.22} seed={52} tint="#d8a090" />
      <ParallaxLayer sim={sim} wRef={wRef} geometry={mesas} depth={-20} scale={0.8} count={4} span={120} speedFactor={0.45} seed={63} tint="#ffffff" />
      <DriftParticles sim={sim} wRef={wRef} zoneId="canyon" />
      <WeightDriver sim={sim} zone={Z} wRef={wRef} groupRef={root} />
    </group>
  );
}

/** The floor: a dusty faceted canyon bed, scrolled with the track, fading in with the zone. */
function Floor({ sim, wRef }) {
  const mesh = useRef();
  const mat = useRef();
  const tex = useMemo(() => {
    const t = createCanyonFloorTexture(S);
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
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, WORLD.groundY + 0.04, -30]}>
      <planeGeometry args={[GROUND_WIDTH, 100]} />
      <meshStandardMaterial ref={mat} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.45} roughness={0.95} transparent depthWrite={false} />
    </mesh>
  );
}
