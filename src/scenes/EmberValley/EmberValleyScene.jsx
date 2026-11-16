import EmberParticles from '../../components/scene/EmberParticles.jsx';
import PlayerBird from '../../components/scene/PlayerBird.jsx';
import ObstacleField from '../../components/scene/ObstacleField.jsx';
import OrbField from '../../components/scene/OrbField.jsx';
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
  useGameLoop(game);

  return (
    <>
      <fog attach="fog" args={['#120806', 22, 75]} />
      <ambientLight intensity={0.3} color="#ffb27a" />
      <hemisphereLight args={['#ff9a4a', '#0a0503', 0.7]} />
      {/* Key light from the front so obstacle faces read clearly */}
      <directionalLight position={[-3, 6, 10]} intensity={1.6} color="#ffd8b0" />

      <CameraRig sim={game} />
      <Backdrop sim={game} />
      <ObstacleField sim={game} />
      <OrbField sim={game} />
      <PlayerBird sim={game} />
      <BurstParticles sim={game} />
      <EmberParticles count={emberCount} area={[34, 14, 10]} position={[4, 0, -3]} scroll={emberScroll} />
    </>
  );
}
