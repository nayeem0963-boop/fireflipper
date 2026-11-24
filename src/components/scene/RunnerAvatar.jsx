import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { AnimationMixer, AnimationUtils, LoopOnce, LoopRepeat } from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { avatarAssetUrl } from '../../systems/versions/versions.js';

/**
 * The v2 player: the GLB named by the version's `playerConfig.assetPath`, drawn with its `scale`, `offset` and `rotation`.
 * Purely visual. It is positioned and pitched by PlayerBird from the simulation, and it never touches the collider, so
 * swapping it changes nothing about the hitbox, the jump trajectory or how the game feels.
 *
 * If the model has an animation (a run, fly or flap cycle) the first matching clip loops, and freezes when the player
 * crashes. While the file loads, or if it is missing or broken, `fallback` (the v1 bird) is drawn instead, so the
 * version stays playable while the asset is added.
 */
class AssetBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn('[Fire Flipper] v2 avatar model failed to load, drawing the v1 bird instead:', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const CLIP = /run|fly|flap|walk/i;

/**
 * Is there a real model at `url`? Checked before loading so a missing file is a quiet fallback and not a thrown load
 * error (a static host answers a missing file with its index.html, which the model loader would choke on). A host that
 * refuses HEAD (405) is given the benefit of the doubt: the load is attempted and the boundary above still catches a failure.
 */
const probes = new Map();
function probeAsset(url) {
  if (!probes.has(url)) {
    probes.set(
      url,
      fetch(url, { method: 'HEAD' })
        .then((r) => r.status === 405 || (r.ok && !/text\/html/i.test(r.headers.get('content-type') ?? '')))
        .catch(() => false)
        .then((found) => {
          if (!found) console.warn(`[Fire Flipper] v2 avatar not found at ${url}: drawing the v1 bird. Add the file, or set assetPath in systems/versions/versions.js.`);
          return found;
        }),
    );
  }
  return probes.get(url);
}

/** null while checking, then true (the file is there) or false. */
function useAssetFound(url) {
  const [found, setFound] = useState(null);
  useEffect(() => {
    let live = true;
    probeAsset(url).then((ok) => live && setFound(ok));
    return () => {
      live = false;
    };
  }, [url]);
  return found;
}

const STROKE_TIME = 0.26; // seconds of a flap (the same as the bird's), during which the stride quickens
const FPS = 30;

/** The actions for a version's clips: cruise (loops), dive (loops), dead (plays once and holds). Without `clips`, the first run/fly/flap/walk clip loops as `cruise`. */
function buildActions(mixer, animations, clips) {
  const byName = Object.fromEntries(animations.map((c) => [c.name, c]));
  const acts = {};
  const loop = (clip) => {
    const a = mixer.clipAction(clip);
    a.setLoop(LoopRepeat, Infinity);
    return a;
  };
  if (!clips) {
    const clip = animations.find((c) => CLIP.test(c.name)) ?? animations[0];
    if (clip) acts.cruise = loop(clip);
    return acts;
  }
  if (byName[clips.cruise]) acts.cruise = loop(byName[clips.cruise]);
  if (clips.dive && byName[clips.dive]) acts.dive = loop(byName[clips.dive]);
  if (clips.dead && byName[clips.dead]) {
    const [a, b] = clips.deadRange ?? [0, byName[clips.dead].duration];
    const clip = AnimationUtils.subclip(byName[clips.dead], 'dead', Math.round(a * FPS), Math.round(b * FPS), FPS);
    acts.dead = mixer.clipAction(clip);
    acts.dead.setLoop(LoopOnce, 1);
    acts.dead.clampWhenFinished = true;
  }
  return acts;
}

// The bird's float, wingSpeed and glow have no meaning for a model without them; they are accepted and dropped here.
// eslint-disable-next-line no-unused-vars
function RunnerModel({ version, flight, lightIntensity, float, wingSpeed, glow, ...props }) {
  const { playerConfig } = version;
  const gltf = useGLTF(avatarAssetUrl(version));
  const state = useRef({ name: '', action: null });

  // A private copy of the model (so two avatars never share a skeleton), with its own mixer.
  const { model, mixer, acts } = useMemo(() => {
    const model = cloneSkinned(gltf.scene);
    // Skinned and quantised meshes can report a bounding box that is wrong for the animated pose: never cull them.
    model.traverse((o) => {
      if (o.isMesh) o.frustumCulled = false;
    });
    const mixer = new AnimationMixer(model);
    return { model, mixer, acts: buildActions(mixer, gltf.animations, playerConfig.clips) };
  }, [gltf, playerConfig.clips]);

  useEffect(() => {
    state.current = { name: '', action: null };
    // Only stop: in development React runs this cleanup and then reuses the same mixer, so its actions must stay valid.
    return () => void mixer.stopAllAction();
  }, [mixer]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const dead = !!flight?.dead;
    const diving = !dead && !!flight && flight.vy < -5 && !!acts.dive;
    const want = dead && acts.dead ? 'dead' : diving ? 'dive' : 'cruise';
    const st = state.current;
    if (want !== st.name && acts[want]) {
      const next = acts[want];
      next.reset().setEffectiveWeight(1).play();
      if (st.action) next.crossFadeFrom(st.action, want === 'dead' ? 0.1 : 0.2, false);
      st.name = want;
      st.action = next;
    }
    // A flap quickens the stride for a moment; the rest of the time she runs at her own pace.
    if (st.name === 'cruise' && acts.cruise) acts.cruise.setEffectiveTimeScale(flight && flight.sinceFlap < STROKE_TIME ? 1.7 : 1);
    mixer.update(dt);
  });

  return (
    <group {...props}>
      <pointLight
        color={playerConfig.trailColor ?? '#ff7a2a'}
        intensity={lightIntensity}
        distance={8}
        decay={1.6}
        position={[0.2, 0.3, 0.8]}
      />
      <group position={playerConfig.offset} scale={playerConfig.scale} rotation={playerConfig.rotation ?? [0, 0, 0]}>
        <primitive object={model} />
      </group>
    </group>
  );
}

export default function RunnerAvatar({ version, fallback, ...props }) {
  const found = useAssetFound(avatarAssetUrl(version));
  if (!found) return fallback; // still checking, or no file: the v1 bird stands in
  return (
    <AssetBoundary fallback={fallback} key={version.id}>
      <Suspense fallback={fallback}>
        <RunnerModel version={version} {...props} />
      </Suspense>
    </AssetBoundary>
  );
}
