import { useTheme } from '../../hooks/useTheme.js';
import { useGameVersion } from '../../hooks/useGameVersion.js';
import { useGameSim } from '../../hooks/useGameSim.js';
import { isRunner } from '../../systems/versions/versions.js';
import SceneCanvas from './SceneCanvas.jsx';
import EmberValleyScene from '../../scenes/EmberValley/EmberValleyScene.jsx';
import { BASE_FOV } from '../../scenes/EmberValley/cameraConfig.js';

/** The gameplay 3D scene, in its own module so GameScreen can lazy-load it. It draws the simulation of the selected game version: the flying game (v1) or the ground-runner (v2). */
export default function GameStage({ paused }) {
  const { scene } = useTheme();
  const sim = useGameSim();
  const runner = isRunner(useGameVersion());
  return (
    <SceneCanvas background={scene.bg} camera={{ position: [0, runner ? -0.15 : 0.5, 10], fov: BASE_FOV }} frameloop={paused ? 'demand' : 'always'}>
      <EmberValleyScene sim={sim} runner={runner} />
    </SceneCanvas>
  );
}
