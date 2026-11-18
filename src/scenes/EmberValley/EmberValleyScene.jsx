import { useThree } from '@react-three/fiber';
import EmberParticles from '../../components/scene/EmberParticles.jsx';
import EdgeWarning from '../../components/scene/EdgeWarning.jsx';
import PlayerBird from '../../components/scene/PlayerBird.jsx';
import ObstacleField from '../../components/scene/ObstacleField.jsx';
import OrbField from '../../components/scene/OrbField.jsx';
import HazardField from '../../components/scene/HazardField.jsx';
import BurstParticles from '../../components/scene/BurstParticles.jsx';
import FlightFx from '../../components/scene/FlightFx.jsx';
import BirdAuras from '../../components/scene/BirdAuras.jsx';
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
      <HazardField sim={game} />
      <OrbField sim={game} />
      <PlayerBird sim={game} />
      <BirdAuras sim={game} />
      <BurstParticles sim={game} />
      <FlightFx sim={game} />
      {/* Narrow screens see less track ahead, so warn about obstacles just off-screen */}
      <EdgeWarning sim={game} enabled={portrait} />
      <EmberParticles count={emberCount} area={[34, 14, 10]} position={[4, 0, -3]} scroll={emberScroll} />
    </>
  );
}
