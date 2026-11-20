import { useTheme } from '../../hooks/useTheme.js';
import SceneCanvas from './SceneCanvas.jsx';
import AvatarStage from '../../scenes/Showcase/AvatarStage.jsx';

/** The picker's live 3D preview, in its own module so three.js loads only when the picker opens. */
export default function AvatarPreview({ avatar }) {
  const { scene } = useTheme();
  return (
    <SceneCanvas background={scene.bg} camera={{ position: [0, 0.15, 6], fov: 40 }}>
      <AvatarStage avatar={avatar} />
    </SceneCanvas>
  );
}
