import { Component, Suspense } from 'react';
import Firebird from './Firebird.jsx';
import ModelBird from './ModelBird.jsx';
import ButterflyBird from './ButterflyBird.jsx';
import FlameBird from './FlameBird.jsx';

/** If a model fails to load (offline, missing file), fall back to the original bird instead of breaking the scene. */
class ModelBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn('[Fire Flipper] bird model failed to load, using the default bird:', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * The player's chosen bird: the original Firebird (in its colour scheme) or a fire-lit model. Props are those of
 * Firebird. While a model loads, the original bird stands in, so the scene is never empty.
 */
export default function AvatarBird({ avatar, ...props }) {
  if (avatar.kind === 'firebird')
    return <Firebird palette={avatar.palette} neutralGlow={avatar.color !== 'fire'} {...props} />;
  const stand = <Firebird {...props} />;
  if (avatar.kind === 'flamebird')
    return (
      <ModelBoundary fallback={stand} key={avatar.id}>
        <Suspense fallback={stand}>
          <FlameBird avatar={avatar} {...props} />
        </Suspense>
      </ModelBoundary>
    );
  return (
    <ModelBoundary fallback={stand} key={avatar.id}>
      <Suspense fallback={stand}>
        {avatar.form === 'butterfly' ? (
          <ButterflyBird avatar={avatar} {...props} />
        ) : (
          <ModelBird avatar={avatar} {...props} />
        )}
      </Suspense>
    </ModelBoundary>
  );
}
