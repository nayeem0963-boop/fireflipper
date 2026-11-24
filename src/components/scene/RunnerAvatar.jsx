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
// Vertical speeds (units/s; a flap gives +7.6, a fall tops out at -11, a dive at -17) that pick her pose.
const RISE_VY = 2;
const FALL_VY = -3;
const DIVE_VY = -11.5;
const LOOPING = new Set(['cruise', 'dive']); // the other states play once and hold their last pose

/** The hip height (cm, in her rig) a jump clip may reach: her jump exports raise the hips about 50 cm, but the game already moves the player. */
const HIP_CEILING = 94;
function removeHipLift(clip) {
  const track = clip.tracks.find((t) => t.name === 'Hips.position');
  if (track) for (let i = 1; i < track.values.length; i += 3) track.values[i] = Math.min(track.values[i], HIP_CEILING);
}

/**
 * The actions for a version's clips, by state: cruise, rise, fall, dive, dead. A clip def is a name or { clip, range, timeScale,
 * loop, noLift } (see versions.js). Without `clips`, the first run/fly/flap/walk clip loops as `cruise`.
 */
function buildActions(mixer, animations, clips) {
  const byName = Object.fromEntries(animations.map((c) => [c.name, c]));
  const acts = {};
  const add = (state, clip, def = {}) => {
    const loops = def.loop ?? LOOPING.has(state);
    const action = mixer.clipAction(clip);
    action.setLoop(loops ? LoopRepeat : LoopOnce, Infinity);
    action.clampWhenFinished = !loops;
    acts[state] = { action, timeScale: def.timeScale ?? 1 };
  };
  if (!clips) {
    const clip = animations.find((c) => CLIP.test(c.name)) ?? animations[0];
    if (clip) add('cruise', clip);
    return acts;
  }
  for (const state of ['cruise', 'rise', 'fall', 'dive', 'dead']) {
    const raw = clips[state];
    if (!raw) continue;
    const def = typeof raw === 'string' ? { clip: raw } : raw;
    const base = byName[def.clip];
    if (!base) continue;
    let clip = base;
    if (def.range) clip = AnimationUtils.subclip(base, state, Math.round(def.range[0] * FPS), Math.round(def.range[1] * FPS), FPS);
    else if (def.noLift) clip = base.clone();
    if (def.noLift) removeHipLift(clip);
    add(state, clip, def);
  }
  return acts;
}

// The bird's float, wingSpeed and glow have no meaning for a model without them; they are accepted and dropped here.
// eslint-disable-next-line no-unused-vars
function RunnerModel({ version, flight, lightIntensity, float, wingSpeed, glow, ...props }) {
  const { playerConfig } = version;
  const gltf = useGLTF(avatarAssetUrl(version));
  const state = useRef({ name: '', action: null, since: 0 });

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
    state.current = { name: '', action: null, since: 0 };
    // Only stop: in development React runs this cleanup and then reuses the same mixer, so its actions must stay valid.
    return () => void mixer.stopAllAction();
  }, [mixer]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    let want = 'cruise';
    if (flight?.dead) want = 'dead';
    else if (flight && flight.vy < DIVE_VY) want = 'dive';
    else if (flight && flight.vy < FALL_VY) want = 'fall';
    else if (flight && flight.vy > RISE_VY) want = 'rise';
    if (!acts[want]) want = 'cruise';
    const st = state.current;
    // A new flap while still climbing starts the take-off pose again.
    const reflap = want === 'rise' && st.name === 'rise' && flight.sinceFlap < st.since;
    if ((want !== st.name || reflap) && acts[want]) {
      const next = acts[want];
      next.action.reset().setEffectiveWeight(1).setEffectiveTimeScale(next.timeScale).play();
      if (st.action && st.action !== next.action) next.action.crossFadeFrom(st.action, want === 'dead' ? 0.1 : 0.2, false);
      st.name = want;
      st.action = next.action;
    }
    st.since = flight ? flight.sinceFlap : 0;
    // A flap quickens the stride for a moment; the rest of the time she runs at her own pace.
    if (st.name === 'cruise' && acts.cruise) acts.cruise.action.setEffectiveTimeScale(flight && flight.sinceFlap < STROKE_TIME ? 1.7 : 1);
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
