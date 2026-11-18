import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { WORLD } from '../../systems/physics/constants.js';
import { BIOMES } from '../../systems/world/biomes.js';
import { createPalacePoolTexture } from './valleyTextures.js';
import { createFloatingIsland } from './celestialGeometry.js';
import { GradientSky, ParallaxLayer, PaintedHorizon, WeightDriver } from './ZoneParts.jsx';

const Z = BIOMES.palace;
const S = Z.scene;
const GROUND_WIDTH = 200;
const GROUND_REPEAT = 50; // 4 world units per tile
/**
 * The three palace paintings (an archway onto a lake of palaces, a waterfall cascade beside the same arches, and a cloud-sea view with a great
 * cathedral). `horizon` is the row of each picture (from the top) that sits on the horizon line: the waterline, so everything below it is replaced by
 * the 3D mirror pool, and everything above is the sunset sky and the palaces.
 */
const PAINTINGS = [
  { file: 'palace-a.jpg', aspect: 1280 / 720, horizon: 0.62 },
  { file: 'palace-b.jpg', aspect: 1280 / 720, horizon: 0.62 },
  { file: 'palace-c.jpg', aspect: 1280 / 720, horizon: 0.66 },
];
/** Where each next painting dissolves in over the one before it (metres). The scenes differ a lot, so the dissolves are longer than elsewhere. */
const CUTS = [3660, 4330];
const DISSOLVE = 70;
/** The paintings load when the player gets this close, so the first screens of the game never wait for them. */
const PRELOAD_AT = 2880;
/** The picture is scaled to about 1.6 times the visible height, so the waterline can sit on the horizon with sky above it. */
const RISE = { from: 0.62, to: 0.62, cover: 1.62 };
const FADE_RGB = [141, 114, 158];

/**
 * The Rose Sky Palace scenery for 3000 to 5000 m: the three palace paintings (public/images/backdrop) fill the sky and drift slowly sideways as
 * you fly; their waterline sits on the horizon, where a 3D mirror pool takes over (golden lantern glints, soft reflection streaks), and small
 * floating white-stone islands with pink trees drift past at two depths. It cross-fades with the Celestial Realm (around 3000 m) and fades back to
 * the original scenery by 5000 m, and is hidden outside that, so it costs nothing elsewhere. Purely visual: nothing here touches the simulation.
 */
export default function PalaceBackdrop({ sim }) {
  const root = useRef();
  const wRef = useRef(0);
  const island = useMemo(() => createFloatingIsland(S), []);
  useEffect(() => () => island.dispose(), [island]);
  return (
    <group ref={root} name="palace" visible={false}>
      <GradientSky wRef={wRef} top={S.skyTop} bottom={S.skyBottom} />
      <PaintedHorizon sim={sim} wRef={wRef} zone={Z} paintings={PAINTINGS} cuts={CUTS} dissolve={DISSOLVE} preloadAt={PRELOAD_AT} fadeRgb={FADE_RGB} rise={RISE} />
      <Pool sim={sim} wRef={wRef} />
      <ParallaxLayer sim={sim} wRef={wRef} geometry={island} depth={-30} scale={1.4} count={5} span={190} speedFactor={0.22} seed={31} tint="#ffffff" lift={[9, 24]} emissive="#ffb0c8" emissiveIntensity={0.55} growAll bob={0.4} />
      <ParallaxLayer sim={sim} wRef={wRef} geometry={island} depth={-18} scale={0.65} count={4} span={120} speedFactor={0.45} seed={44} tint="#ffffff" lift={[7, 15]} emissive="#ffb0c8" emissiveIntensity={0.55} growAll bob={0.3} />
      <WeightDriver sim={sim} zone={Z} wRef={wRef} groupRef={root} />
    </group>
  );
}

/** The floor: a mirror-still pink pool, scrolled with the track, fading in with the zone. */
function Pool({ sim, wRef }) {
  const mesh = useRef();
  const mat = useRef();
  const tex = useMemo(() => {
    const t = createPalacePoolTexture(S);
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
      <meshStandardMaterial ref={mat} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.65} roughness={0.35} metalness={0.15} transparent depthWrite={false} />
    </mesh>
  );
}
