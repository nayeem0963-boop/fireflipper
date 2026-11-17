import { Component, Suspense } from 'react';
import FireEagle from './FireEagle.jsx';
import PlaceholderFirebird from './PlaceholderFirebird.jsx';

/**
 * The player/showcase firebird: the GLB fire eagle, with the primitive bird
 * standing in while the model downloads or if it can't be loaded, so the game
 * never blocks on (or breaks because of) the asset.
 *
 * Props (shared by both versions):
 *  - float:          vertical bob amplitude (world units)
 *  - wingSpeed:      base wing-beat speed (radians/sec)
 *  - glow:           halo sprite opacity
 *  - lightIntensity: strength of the warm point light the bird casts
 *  - flight:         optional live flight state { vy, sinceFlap, dead } from the
 *                    simulation; wings then follow real flaps, dives and crashes.
 */
class ModelBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn('[Fire Flipper] Fire eagle model failed to load; using the placeholder.', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function Firebird(props) {
  const fallback = <PlaceholderFirebird {...props} />;
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <FireEagle {...props} />
      </Suspense>
    </ModelBoundary>
  );
}
