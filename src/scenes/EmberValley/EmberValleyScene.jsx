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

  // Lights, fog and background blend from the theme's colours to each zone's daylight colours (Sundarbans 0-500 m,
  // Amazon 1000-1500 m). The zones never overlap, so at most one weight is non-zero.
  const fog = useRef();
  const ambient = useRef();
  const hemi = useRef();
  const key = useRef();
  const colors = useMemo(() => {
    const c = (hex) => new Color(hex);
    const S = BIOMES.sundarbans.scene;
    const A = BIOMES.amazon.scene;
    const trio = (theme, k) => [c(theme), c(S[k]), c(A[k])];
    return {
      fog: trio(scene.fog, 'fog'), bg: trio(scene.bg, 'bg'), amb: trio(scene.ambient, 'ambient'),
      sky: trio(scene.hemiSky, 'hemiSky'), gnd: trio(scene.hemiGround, 'hemiGround'), key: trio(scene.key, 'key'),
    };
  }, [scene]);
  const tmp = useMemo(() => new Color(), []);
  const blend = (target, [base, sund, amaz], ws, wa) => target.copy(base).lerp(sund, ws).lerp(amaz, wa);
  const lastKey = useRef(-1);
  useEffect(() => {
    lastKey.current = -1; // re-apply the blend after a theme change
  }, [colors]);
  useFrame((state) => {
    const w = biomeWeights(game.renderDistance());
    const k = w.sundarbans * 1000 + w.amazon * 1000 + (w.amazon > 0 ? 5000 : 0);
    if (Math.abs(k - lastKey.current) < 2 && lastKey.current !== -1) return;
    lastKey.current = k;
    if (fog.current) blend(fog.current.color, colors.fog, w.sundarbans, w.amazon);
    if (state.scene.background?.isColor) blend(state.scene.background, colors.bg, w.sundarbans, w.amazon);
    if (ambient.current) blend(ambient.current.color, colors.amb, w.sundarbans, w.amazon);
    if (hemi.current) {
      blend(hemi.current.color, colors.sky, w.sundarbans, w.amazon);
      blend(hemi.current.groundColor, colors.gnd, w.sundarbans, w.amazon);
    }
    if (key.current) blend(key.current.color, colors.key, w.sundarbans, w.amazon);
    void tmp;
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
      <AmazonBackdrop sim={game} />
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
