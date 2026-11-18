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
import { BIOMES, biomeWeight } from '../../systems/world/biomes.js';

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

  // Lights, fog and background blend from the theme's colours to daylight Sundarbans colours over the first 500 m.
  const fog = useRef();
  const ambient = useRef();
  const hemi = useRef();
  const key = useRef();
  const S = BIOMES.sundarbans.scene;
  const colors = useMemo(() => {
    const c = (hex) => new Color(hex);
    return {
      fogA: c(scene.fog), fogB: c(S.fog), bgA: c(scene.bg), bgB: c(S.bg),
      ambA: c(scene.ambient), ambB: c(S.ambient), skyA: c(scene.hemiSky), skyB: c(S.hemiSky),
      gndA: c(scene.hemiGround), gndB: c(S.hemiGround), keyA: c(scene.key), keyB: c(S.key),
    };
  }, [scene, S]);
  const lastW = useRef(-1);
  useEffect(() => {
    lastW.current = -1; // re-apply the blend after a theme change
  }, [colors]);
  useFrame((state) => {
    const w = biomeWeight(game.renderDistance());
    if (Math.abs(w - lastW.current) < 0.002 && lastW.current !== -1) return;
    lastW.current = w;
    if (fog.current) fog.current.color.lerpColors(colors.fogA, colors.fogB, w);
    if (state.scene.background?.isColor) state.scene.background.lerpColors(colors.bgA, colors.bgB, w);
    if (ambient.current) ambient.current.color.lerpColors(colors.ambA, colors.ambB, w);
    if (hemi.current) {
      hemi.current.color.lerpColors(colors.skyA, colors.skyB, w);
      hemi.current.groundColor.lerpColors(colors.gndA, colors.gndB, w);
    }
    if (key.current) key.current.color.lerpColors(colors.keyA, colors.keyB, w);
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
