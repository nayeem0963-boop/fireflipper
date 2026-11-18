import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { WORLD } from '../../systems/physics/constants.js';
import { BIOMES } from '../../systems/world/biomes.js';
import { createStarSeaTexture } from './valleyTextures.js';
import { createFloatingIsland } from './celestialGeometry.js';
import { GradientSky, ParallaxLayer, PaintedHorizon, WeightDriver } from './ZoneParts.jsx';

const Z = BIOMES.celestial;
const S = Z.scene;
const GROUND_WIDTH = 200;
const GROUND_REPEAT = 50; // 4 world units per tile
/**
 * The three cosmic paintings (floating crystal cities among galaxies and a ringed planet; the same sky with a wider view of the cities; and the
 * same with a figure on a balcony). Their skies are identical, so dissolving between them keeps the sky steady while the cities change.
 */
const PAINTINGS = [
  { file: 'celestial-a.jpg', aspect: 1280 / 698 },
  { file: 'celestial-b.jpg', aspect: 1280 / 698 },
  { file: 'celestial-c.jpg', aspect: 1280 / 698 },
];
/** Where each next painting dissolves in over the one before it (metres). */
const CUTS = [2330, 2660];
/** The paintings load when the player gets this close, so the first screens of the game never wait for them. */
const PRELOAD_AT = 1880;
/** The picture slides from its floating cities (0.98 of the way down) up to the planet, galaxies and nebulae (0.12, clamped so no edge shows) over the zone. */
const RISE = { from: 0.98, to: 0.12 };
const FADE_RGB = [50, 59, 92];

/**
 * The Celestial Realm scenery for 2000 to 3000 m: the three cosmic paintings (public/images/backdrop) fill the sky and slowly slide as you
 * fly, so the view climbs from the floating cities up into the cosmos. The floor is a starlit cloud sea, and a few small floating crystal
 * islands drift past at two depths for parallax. It cross-fades with the Arctic (around 2000 m) and fades back to the original scenery by
 * 3000 m, and is hidden outside that, so it costs nothing elsewhere. Purely visual: nothing here touches the simulation.
 */
export default function CelestialBackdrop({ sim }) {
  const root = useRef();
  const wRef = useRef(0);
  const island = useMemo(() => createFloatingIsland(S), []);
  useEffect(() => () => island.dispose(), [island]);
  return (
    <group ref={root} name="celestial" visible={false}>
      <GradientSky wRef={wRef} top={S.skyTop} bottom={S.skyBottom} />
      <PaintedHorizon sim={sim} wRef={wRef} zone={Z} paintings={PAINTINGS} cuts={CUTS} preloadAt={PRELOAD_AT} fadeRgb={FADE_RGB} rise={RISE} depth />
      <StarSea sim={sim} wRef={wRef} />
      <ParallaxLayer sim={sim} wRef={wRef} geometry={island} depth={-30} scale={1.5} count={6} span={190} speedFactor={0.22} seed={8} tint="#ffffff" lift={[10, 28]} emissive="#7a78c8" emissiveIntensity={0.75} growAll bob={0.4} />
      <ParallaxLayer sim={sim} wRef={wRef} geometry={island} depth={-18} scale={0.7} count={4} span={120} speedFactor={0.45} seed={19} tint="#ffffff" lift={[8, 17]} emissive="#7a78c8" emissiveIntensity={0.75} growAll bob={0.3} />
      <WeightDriver sim={sim} zone={Z} wRef={wRef} groupRef={root} />
    </group>
  );
}

/** The floor: a starlit cloud sea, scrolled with the track, fading in with the zone. */
function StarSea({ sim, wRef }) {
  const mesh = useRef();
  const mat = useRef();
  const tex = useMemo(() => {
    const t = createStarSeaTexture(S);
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
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, WORLD.groundY + 0.06, -30]}>
      <planeGeometry args={[GROUND_WIDTH, 100]} />
      <meshStandardMaterial ref={mat} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.7} roughness={0.7} metalness={0.1} transparent depthWrite={false} />
    </mesh>
  );
}
