import { Component } from 'react';

/**
 * Catches renderer failures (no WebGL, lost context on init, shader
 * errors) so the UI around the canvas keeps working and the player
 * sees a message instead of a blank screen.
 */
export default class WebGLErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('[Fire Flipper] 3D renderer failed:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="webgl-fallback" role="alert">
          3D graphics could not start on this device. Try updating your browser or enabling hardware acceleration.
        </div>
      );
    }
    return this.props.children;
  }
}
