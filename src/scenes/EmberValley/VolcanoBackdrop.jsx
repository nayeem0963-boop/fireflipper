import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { WORLD } from '../../systems/physics/constants.js';
import { BIOMES } from '../../systems/world/biomes.js';
import { createCoastShoreTexture, createCoastWaterTexture } from './valleyTextures.js';
import { createCoastRocks } from './mangroveGeometry.js';
import { GradientSky, ParallaxLayer, PaintedHorizon, WeightDriver, smooth } from './ZoneParts.jsx';

const Z = BIOMES.volcano;
const S = Z.scene;
const GROUND_WIDTH = 200;
const GROUND_REPEAT = 50; // 4 world units per tile
/** The three paintings, in the order they appear (volcano; volcano and snow-capped range; sandstone buttes on the shore). Aspect of each cropped band. */
const PAINTINGS = [
  { file: 'coast-a.jpg', aspect: 1600 / 370 },
  { file: 'coast-b.jpg', aspect: 1600 / 370 },
  { file: 'coast-c.jpg', aspect: 1600 / 370 },
];
/** Where each next painting dissolves in over the one before it (metres). */
const CUTS = [660, 820];
/** The paintings load when the player gets this close, so the first screens of the game never wait for them. */
const PRELOAD_AT = 380;
const FADE_RGB = [175, 218, 217];

/**
 * The Volcanic Coast scenery for 500 to 1000 m. The far scenery is the three coast paintings (public/images/backdrop), each cropped
 * to its sky-and-horizon band, scaled to the view, and dissolved one into the next as you fly; the sea, the sandy shore and the
 * rock islands are 3D, matched to the paintings' colours, so the horizon joins up and the scenery still has depth and parallax.
 * It cross-fades with the Sundarbans (around 500 m) and the Amazon (around 1000 m) and is hidden outside that, so it costs nothing
 * elsewhere. Purely visual: nothing here touches the simulation.
 */
export default function VolcanoBackdrop({ sim }) {
  const root = useRef();
  const wRef = useRef(0);
  const rocks = useMemo(() => createCoastRocks(S.rock), []);
  useEffect(() => () => rocks.dispose(), [rocks]);
  return (
    <group ref={root} name="volcano" visible={false}>
      <GradientSky wRef={wRef} top={S.skyTop} bottom={S.skyMid} />
      <PaintedHorizon sim={sim} wRef={wRef} zone={Z} paintings={PAINTINGS} cuts={CUTS} preloadAt={PRELOAD_AT} fadeRgb={FADE_RGB} />
      <Sea sim={sim} wRef={wRef} />
      <Shore sim={sim} wRef={wRef} />
      <ParallaxLayer sim={sim} wRef={wRef} geometry={rocks} depth={-31} scale={2.0} count={6} span={170} speedFactor={0.3} seed={4} tint="#c9d2c8" />
      <ParallaxLayer sim={sim} wRef={wRef} geometry={rocks} depth={-17} scale={0.95} count={5} span={104} speedFactor={0.55} seed={12} tint="#ffffff" />
      <WeightDriver sim={sim} zone={Z} wRef={wRef} groupRef={root} />
    </group>
  );
}

/** The sea: a faceted jade floor, scrolled with the track, fading in with the zone. */
function Sea({ sim, wRef }) {
  const mesh = useRef();
  const mat = useRef();
  const tex = useMemo(() => {
    const t = createCoastWaterTexture(S);
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
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, WORLD.groundY + 0.03, -30]}>
      <planeGeometry args={[GROUND_WIDTH, 100]} />
      <meshStandardMaterial ref={mat} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.5} roughness={0.8} transparent depthWrite={false} />
    </mesh>
  );
}

/** The sandy shore, laid over the sea's far side from about 760 m so the last stretch ends on a beach under the buttes. */
function Shore({ sim, wRef }) {
  const mesh = useRef();
  const mat = useRef();
  const tex = useMemo(() => {
    const t = createCoastShoreTexture(S);
    t.repeat.set(GROUND_REPEAT, 1);
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame((state) => {
    const d = sim.renderDistance();
    tex.offset.x = (d / (GROUND_WIDTH / GROUND_REPEAT)) % 1;
    const k = smooth(760, 860, d);
    if (mesh.current) {
      mesh.current.position.x = state.camera.position.x;
      mesh.current.visible = k > 0.002;
    }
    if (mat.current) mat.current.opacity = Math.min(1, wRef.current * 2) * k;
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, WORLD.groundY + 0.04, -30]} visible={false}>
      <planeGeometry args={[GROUND_WIDTH, 100]} />
      <meshStandardMaterial ref={mat} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.5} roughness={0.9} transparent depthWrite={false} />
    </mesh>
  );
}
