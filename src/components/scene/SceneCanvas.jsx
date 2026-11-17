import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { useRenderSettings } from '../../hooks/useRenderSettings.js';
import WebGLErrorBoundary from './WebGLErrorBoundary.jsx';

/**
 * Shared <Canvas> wrapper so every screen gets the same renderer setup:
 * capped device-pixel-ratio, adaptive DPR via PerformanceMonitor, and an
 * opaque WebGL context (cheaper than alpha compositing).
 *
 * `frameloop="demand"` can be passed to stop rendering (e.g. when paused).
 */
export default function SceneCanvas({
  children,
  camera,
  frameloop = 'always',
  className,
  background = '#0b0907',
}) {
  const { maxDpr, antialias } = useRenderSettings();
  const deviceDpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  const [dpr, setDpr] = useState(() => Math.min(deviceDpr, maxDpr));
  const cappedDpr = Math.min(dpr, maxDpr);

  return (
    <WebGLErrorBoundary>
      <Canvas
        className={className}
        dpr={cappedDpr}
        frameloop={frameloop}
        camera={camera}
        gl={{ antialias, alpha: false, powerPreference: 'high-performance', stencil: false }}
      >
        <color attach="background" args={[background]} />
        <PerformanceMonitor
          onDecline={() => setDpr((d) => Math.max(1, d - 0.5))}
          onIncline={() => setDpr((d) => Math.min(maxDpr, d + 0.25))}
          flipflops={3}
          onFallback={() => setDpr(1)}
        />
        {children}
      </Canvas>
    </WebGLErrorBoundary>
  );
}
