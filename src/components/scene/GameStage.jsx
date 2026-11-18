import SceneCanvas from './SceneCanvas.jsx';
import EmberValleyScene from '../../scenes/EmberValley/EmberValleyScene.jsx';
import { BASE_FOV } from '../../scenes/EmberValley/cameraConfig.js';

/** The gameplay 3D scene, in its own module so GameScreen can lazy-load it. */
export default function GameStage({ paused }) {
  return (
    <SceneCanvas camera={{ position: [0, 0.5, 10], fov: BASE_FOV }} frameloop={paused ? 'demand' : 'always'}>
      <EmberValleyScene />
    </SceneCanvas>
  );
}
