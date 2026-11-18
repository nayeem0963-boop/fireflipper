import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { WORLD } from '../../systems/physics/constants.js';
import { BIOMES } from '../../systems/world/biomes.js';
import { createSnowTexture } from './valleyTextures.js';
import { createArcticCamp, createSnowOutcrops } from './arcticGeometry.js';
import { GradientSky, ParallaxLayer, PaintedHorizon, WeightDriver } from './ZoneParts.jsx';

const Z = BIOMES.arctic;
const S = Z.scene;
const GROUND_WIDTH = 200;
const GROUND_REPEAT = 50; // 4 world units per tile
/** The three paintings, in the order they appear (ice shelf and camp; ice shelf, canyon and station; the same with finer detail). Aspect of each cropped band. */
const PAINTINGS = [
  { file: 'arctic-a.jpg', aspect: 1600 / 352 },
  { file: 'arctic-b.jpg', aspect: 1600 / 280 },
  { file: 'arctic-c.jpg', aspect: 1600 / 280 },
];
/** Where each next painting dissolves in over the one before it (metres). */
const CUTS = [1720, 1860];
/** The paintings load when the player gets this close, so the first screens of the game never wait for them. */
const PRELOAD_AT = 1380;
const FADE_RGB = [187, 236, 242];

/**
 * The Arctic Ice Shelf scenery for 1500 to 2000 m: the three arctic paintings (public/images/backdrop) cropped to their horizon band, an
 * aurora sky, a faceted snowfield, and slate outcrops and a research camp (tents, snowmobile, mast, flagged cairn) in 3D for depth and
 * parallax. It cross-fades with the Amazon (around 1500 m) and fades back to the original scenery by 2000 m, and is hidden outside that,
 * so it costs nothing elsewhere. Purely visual: nothing here touches the simulation.
 */
export default function ArcticBackdrop({ sim }) {
  const root = useRef();
  const wRef = useRef(0);
  const outcrops = useMemo(() => createSnowOutcrops(S.rock), []);
  const camp = useMemo(() => createArcticCamp(S), []);
  useEffect(
    () => () => {
      outcrops.dispose();
      camp.dispose();
    },
    [outcrops, camp],
  );
  return (
    <group ref={root} name="arctic" visible={false}>
      <GradientSky wRef={wRef} top={S.skyTop} bottom={S.skyMid} />
      <PaintedHorizon sim={sim} wRef={wRef} zone={Z} paintings={PAINTINGS} cuts={CUTS} preloadAt={PRELOAD_AT} fadeRgb={FADE_RGB} />
      <Snow sim={sim} wRef={wRef} />
      <ParallaxLayer sim={sim} wRef={wRef} geometry={camp} depth={-27} scale={1.9} count={2} span={150} speedFactor={0.3} seed={9} tint="#ffffff" />
      <ParallaxLayer sim={sim} wRef={wRef} geometry={outcrops} depth={-34} scale={2.4} count={7} span={170} speedFactor={0.22} seed={6} tint="#dfe6ea" />
      <ParallaxLayer sim={sim} wRef={wRef} geometry={outcrops} depth={-17} scale={0.95} count={5} span={104} speedFactor={0.55} seed={14} tint="#ffffff" />
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
