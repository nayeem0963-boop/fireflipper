import { useEffect, useMemo, useRef } from 'react';
import { Color } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import EmberParticles from '../../components/scene/EmberParticles.jsx';
import EdgeWarning from '../../components/scene/EdgeWarning.jsx';
import PlayerBird from '../../components/scene/PlayerBird.jsx';
import ObstacleField from '../../components/scene/ObstacleField.jsx';
import HazardTelegraph from './HazardTelegraph.jsx';
import OrbField from '../../components/scene/OrbField.jsx';
import BurstParticles from '../../components/scene/BurstParticles.jsx';
import { useRenderSettings } from '../../hooks/useRenderSettings.js';
import { useGameLoop } from '../../systems/game/useGameLoop.js';
import { game } from '../../systems/game/gameInstance.js';
import { PHASE } from '../../systems/game/createGameSim.js';
import { useTheme } from '../../hooks/useTheme.js';
import CameraRig from './CameraRig.jsx';
import Backdrop from './Backdrop.jsx';
import CanyonBackdrop from './CanyonBackdrop.jsx';
import ArcticBackdrop from './ArcticBackdrop.jsx';
import CelestialBackdrop from './CelestialBackdrop.jsx';
import PalaceBackdrop from './PalaceBackdrop.jsx';
import SanctuaryBackdrop from './SanctuaryBackdrop.jsx';
import ForegroundLayer from './ForegroundLayer.jsx';
import { BIOMES, ZONE_IDS, biomeWeights } from '../../systems/world/biomes.js';

/**
 * Ember Valley: the first level. Composition only. Gameplay lives in the
 * simulation (systems/game); each child renders one aspect of it.
 */
const emberScroll = () => (game.phase === PHASE.RUNNING || game.phase === PHASE.DYING ? game.speed * 0.6 : 0);

export default function EmberValleyScene() {
  const { emberCount } = useRenderSettings();
  const { scene } = useTheme();
  const portrait = useThree((s) => s.size.width < s.size.height);
  useGameLoop(game);

  // Lights, fog and background blend from the theme's colours to each zone's colours: a weighted mix, base * (1 - total) + sum(zone * weight), so a
  // cross-fade between two zones is exact. It loops over every zone (systems/world/biomes.js), so a new zone needs nothing here.
  const fog = useRef();
  const ambient = useRef();
  const hemi = useRef();
  const key = useRef();
  const colors = useMemo(() => {
    const c = (hex) => new Color(hex);
    const set = (theme, k) => ({ base: c(theme), zones: ZONE_IDS.map((id) => c(BIOMES[id].scene[k])) });
    return {
      fog: set(scene.fog, 'fog'), bg: set(scene.bg, 'bg'), amb: set(scene.ambient, 'ambient'),
      sky: set(scene.hemiSky, 'hemiSky'), gnd: set(scene.hemiGround, 'hemiGround'), key: set(scene.key, 'key'),
    };
  }, [scene]);
  const tmp = useMemo(() => new Color(), []);
  const weights = useMemo(() => new Array(ZONE_IDS.length).fill(0), []);
  const mix = (target, { base, zones }) => {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    target.copy(base).multiplyScalar(1 - Math.min(1, total));
    for (let i = 0; i < weights.length; i++) if (weights[i] > 0) target.add(tmp.copy(zones[i]).multiplyScalar(weights[i]));
  };
  const lastKey = useRef(-1);
  useEffect(() => {
    lastKey.current = -1; // re-apply the blend after a theme change
  }, [colors]);
  useFrame((state) => {
    const bw = biomeWeights(game.renderDistance());
    let k = 1;
    for (let i = 0; i < ZONE_IDS.length; i++) {
      weights[i] = bw[ZONE_IDS[i]];
      k += weights[i] * (i + 1) * 997;
    }
    if (Math.abs(k - lastKey.current) < 2 && lastKey.current !== -1) return;
    lastKey.current = k;
    if (fog.current) mix(fog.current.color, colors.fog);
    if (state.scene.background?.isColor) mix(state.scene.background, colors.bg);
    if (ambient.current) mix(ambient.current.color, colors.amb);
    if (hemi.current) {
      mix(hemi.current.color, colors.sky);
      mix(hemi.current.groundColor, colors.gnd);
    }
    if (key.current) mix(key.current.color, colors.key);
  });

  return (
    <>
      <fog ref={fog} attach="fog" args={[scene.fog, 22, 75]} />
      <ambientLight ref={ambient} intensity={0.3} color={scene.ambient} />
      <hemisphereLight ref={hemi} args={[scene.hemiSky, scene.hemiGround, 0.7]} />
      {/* Key light from the front so obstacle faces read clearly */}
      <directionalLight ref={key} position={[-3, 6, 10]} intensity={1.6} color={scene.key} />

      <CameraRig sim={game} />
      <Backdrop sim={game} />
      <CanyonBackdrop sim={game} />
      <ArcticBackdrop sim={game} />
      <CelestialBackdrop sim={game} />
      <PalaceBackdrop sim={game} />
      <SanctuaryBackdrop sim={game} />
      <ObstacleField sim={game} />
      <HazardTelegraph sim={game} />
      <OrbField sim={game} />
      <ForegroundLayer sim={game} />
      <PlayerBird sim={game} />
      <BurstParticles sim={game} />
      {/* Narrow screens see less track ahead, so warn about obstacles just off-screen */}
      <EdgeWarning sim={game} enabled={portrait} />
      <EmberParticles count={emberCount} color={scene.ember} area={[34, 14, 10]} position={[4, 0, -3]} scroll={emberScroll} />
    </>
  );
}
