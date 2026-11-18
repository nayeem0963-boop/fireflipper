import SceneCanvas from './SceneCanvas.jsx';
import ShowcaseScene from '../../scenes/Showcase/ShowcaseScene.jsx';

/** The menu's 3D preview, in its own module so HomeScreen can lazy-load it: the menu UI paints while three.js loads. */
export default function HomeStage({ paused }) {
  return (
    <SceneCanvas camera={{ position: [0, 0.25, 6], fov: 45 }} frameloop={paused ? 'demand' : 'always'}>
      <ShowcaseScene />
    </SceneCanvas>
  );
}
