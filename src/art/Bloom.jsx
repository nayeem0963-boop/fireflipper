import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector2 } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { bloomSamples } from './bloom.js';

/**
 * Real bloom, using the post-processing passes that ship with three.js (no extra dependency): the scene is drawn into a
 * half-float (high dynamic range) buffer, the bright parts are blurred at several scales and added back (UnrealBloomPass),
 * and a final pass applies the renderer's tone mapping and colour space.
 *
 * Mounting this takes over rendering (the effect composer draws every frame at priority 1), and unmounting it gives rendering
 * back to react-three-fiber, so turning bloom off costs nothing. `renderRef` is set to a function that draws one frame through
 * the composer, so "Save PNG" can include the bloom.
 */
export default function Bloom({ strength, threshold, radius, quality, renderRef }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const rig = useMemo(() => {
    const composer = new EffectComposer(gl);
    const samples = bloomSamples(quality);
    composer.renderTarget1.samples = samples;
    composer.renderTarget2.samples = samples;
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.8, 0.5, 0.6);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    return { composer, bloom };
  }, [gl, scene, camera, quality]);

  useEffect(() => {
    rig.bloom.strength = strength;
    rig.bloom.threshold = threshold;
    rig.bloom.radius = radius;
  }, [rig, strength, threshold, radius]);

  // Keep the buffers the size of the canvas (the adaptive resolution changes the pixel ratio too).
  useEffect(() => {
    rig.composer.setPixelRatio(dpr);
    rig.composer.setSize(size.width, size.height);
  }, [rig, size.width, size.height, dpr]);

  useEffect(() => {
    renderRef.current = () => rig.composer.render();
    return () => {
      renderRef.current = null;
      rig.composer.passes.forEach((p) => p.dispose?.());
      rig.composer.dispose();
    };
  }, [rig, renderRef]);

  useFrame((_, delta) => rig.composer.render(Math.min(delta, 0.05)), 1);
  return null;
}
