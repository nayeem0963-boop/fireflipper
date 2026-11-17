import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { biomeBlendAt } from '../../systems/biomes/biomes.js';
import { getBiome } from './biomeColors.js';
import EmberParticles from '../../components/scene/EmberParticles.jsx';
import EdgeWarning from '../../components/scene/EdgeWarning.jsx';
import PlayerBird from '../../components/scene/PlayerBird.jsx';
import GhostBird from '../../components/scene/GhostBird.jsx';
import ObstacleField from '../../components/scene/ObstacleField.jsx';
import OrbField from '../../components/scene/OrbField.jsx';
import PowerUpField from '../../components/scene/PowerUpField.jsx';
import BurstParticles from '../../components/scene/BurstParticles.jsx';
import { useRenderSettings } from '../../hooks/useRenderSettings.js';
import { useGameLoop } from '../../systems/game/useGameLoop.js';
import { game } from '../../systems/game/gameInstance.js';
import { PHASE } from '../../systems/game/createGameSim.js';
import CameraRig from './CameraRig.jsx';
import Backdrop from './Backdrop.jsx';

/**
 * Ember Valley: the first level. Composition only. Gameplay lives in the
 * simulation (systems/game); each child renders one aspect of it.
 */
const emberScroll = () => (game.phase === PHASE.RUNNING || game.phase === PHASE.DYING ? game.speed * 0.6 : 0);

export default function EmberValleyScene() {
  const { emberCount } = useRenderSettings();
  const portrait = useThree((s) => s.size.width < s.size.height);
  useGameLoop(game);

  const fog = useRef();
  const ambient = useRef();
  const hemi = useRef();
  const key = useRef();
  useFrame(() => {
    const biome = getBiome(biomeBlendAt(game.renderDistance()));
    fog.current?.color.copy(biome.fog);
    ambient.current?.color.copy(biome.ambient);
    hemi.current?.color.copy(biome.hemiSky);
    hemi.current?.groundColor.copy(biome.hemiGround);
    key.current?.color.copy(biome.key);
  });

  return (
    <>
      <fog ref={fog} attach="fog" args={['#120806', 22, 75]} />
      <ambientLight ref={ambient} intensity={0.3} color="#ffb27a" />
      <hemisphereLight ref={hemi} args={['#ff9a4a', '#0a0503', 0.7]} />
      {/* Key light from the front so obstacle faces read clearly */}
      <directionalLight ref={key} position={[-3, 6, 10]} intensity={1.6} color="#ffd8b0" />

      <CameraRig sim={game} />
      <Backdrop sim={game} />
      <ObstacleField sim={game} />
      <OrbField sim={game} />
      <PowerUpField sim={game} />
      <GhostBird sim={game} />
      <PlayerBird sim={game} />
      <BurstParticles sim={game} />
      {/* Narrow screens see less track ahead, so warn about obstacles just off-screen */}
      <EdgeWarning sim={game} enabled={portrait} />
      <EmberParticles count={emberCount} area={[34, 14, 10]} position={[4, 0, -3]} scroll={emberScroll} />
    </>
  );
}
