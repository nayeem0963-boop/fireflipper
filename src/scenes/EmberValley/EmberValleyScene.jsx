import { useEffect, useMemo, useRef } from 'react';
import { Color } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import EmberParticles from '../../components/scene/EmberParticles.jsx';
import EdgeWarning from '../../components/scene/EdgeWarning.jsx';
import PlayerBird from '../../components/scene/PlayerBird.jsx';
import ObstacleField from '../../components/scene/ObstacleField.jsx';
import OrbField from '../../components/scene/OrbField.jsx';
import BurstParticles from '../../components/scene/BurstParticles.jsx';
import { useRenderSettings } from '../../hooks/useRenderSettings.js';
import { useGameLoop } from '../../systems/game/useGameLoop.js';
import { game } from '../../systems/game/gameInstance.js';
import { PHASE } from '../../systems/game/createGameSim.js';
import { useTheme } from '../../hooks/useTheme.js';
import CameraRig from './CameraRig.jsx';
import Backdrop from './Backdrop.jsx';
import SundarbansBackdrop from './SundarbansBackdrop.jsx';
import AmazonBackdrop from './AmazonBackdrop.jsx';
import VolcanoBackdrop from './VolcanoBackdrop.jsx';
import ArcticBackdrop from './ArcticBackdrop.jsx';
import { BIOMES, biomeWeights } from '../../systems/world/biomes.js';

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

  // Lights, fog and background blend from the theme's colours to each zone's daylight colours (Sundarbans 0-500 m, Volcanic
  // Coast 500-1000 m, Amazon 1000-1500 m, Arctic 1500-2000 m): a weighted mix, base * (1 - total) + zone * weight, so a cross-fade between two zones is exact.
  const fog = useRef();
  const ambient = useRef();
  const hemi = useRef();
  const key = useRef();
  const colors = useMemo(() => {
    const c = (hex) => new Color(hex);
    const Z = [BIOMES.sundarbans.scene, BIOMES.volcano.scene, BIOMES.amazon.scene, BIOMES.arctic.scene];
    const set = (theme, k) => ({ base: c(theme), zones: Z.map((z) => c(z[k])) });
    return {
      fog: set(scene.fog, 'fog'), bg: set(scene.bg, 'bg'), amb: set(scene.ambient, 'ambient'),
      sky: set(scene.hemiSky, 'hemiSky'), gnd: set(scene.hemiGround, 'hemiGround'), key: set(scene.key, 'key'),
    };
  }, [scene]);
  const tmp = useMemo(() => new Color(), []);
  const mix = (target, { base, zones }, w) => {
    const total = Math.min(1, w[0] + w[1] + w[2] + w[3]);
    target.copy(base).multiplyScalar(1 - total);
    for (let i = 0; i < 4; i++) if (w[i] > 0) target.add(tmp.copy(zones[i]).multiplyScalar(w[i]));
  };
  const lastKey = useRef(-1);
  useEffect(() => {
    lastKey.current = -1; // re-apply the blend after a theme change
  }, [colors]);
  useFrame((state) => {
    const bw = biomeWeights(game.renderDistance());
    const w = [bw.sundarbans, bw.volcano, bw.amazon, bw.arctic];
    const k = w[0] * 1000 + w[1] * 3000 + w[2] * 9000 + w[3] * 27000 + 1;
    if (Math.abs(k - lastKey.current) < 2 && lastKey.current !== -1) return;
    lastKey.current = k;
    if (fog.current) mix(fog.current.color, colors.fog, w);
    if (state.scene.background?.isColor) mix(state.scene.background, colors.bg, w);
    if (ambient.current) mix(ambient.current.color, colors.amb, w);
    if (hemi.current) {
      mix(hemi.current.color, colors.sky, w);
      mix(hemi.current.groundColor, colors.gnd, w);
    }
    if (key.current) mix(key.current.color, colors.key, w);
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
      <SundarbansBackdrop sim={game} />
      <VolcanoBackdrop sim={game} />
      <AmazonBackdrop sim={game} />
      <ArcticBackdrop sim={game} />
      <ObstacleField sim={game} />
      <OrbField sim={game} />
      <PlayerBird sim={game} />
      <BurstParticles sim={game} />
      {/* Narrow screens see less track ahead, so warn about obstacles just off-screen */}
      <EdgeWarning sim={game} enabled={portrait} />
      <EmberParticles count={emberCount} color={scene.ember} area={[34, 14, 10]} position={[4, 0, -3]} scroll={emberScroll} />
    </>
  );
}
