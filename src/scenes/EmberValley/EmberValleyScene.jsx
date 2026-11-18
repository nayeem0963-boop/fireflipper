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
import Environment from './Environment.jsx';

/**
 * The journey (Ember Valley and the lands beyond it): composition only. The environment changes
 * continuously with distance (see systems/world/environments.js). Gameplay lives in the
 * simulation (systems/game); each child renders one aspect of it.
 */
const emberScroll = () => (game.phase === PHASE.RUNNING || game.phase === PHASE.DYING ? game.speed * 0.6 : 0);

export default function EmberValleyScene() {
  const { emberCount } = useRenderSettings();
  const portrait = useThree((s) => s.size.width < s.size.height);
  useGameLoop(game);

  return (
    <>
      {/* Fog, background and lights follow the blended environment of the journey */}
      <Environment sim={game} />

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
      <EmberParticles sim={game} count={emberCount} area={[34, 14, 10]} position={[4, 0, -3]} scroll={emberScroll} />
    </>
  );
}
