import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
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

// The bird's float, wingSpeed and glow have no meaning for a model without them; they are accepted and dropped here.
// eslint-disable-next-line no-unused-vars
function RunnerModel({ version, flight, lightIntensity, float, wingSpeed, glow, ...props }) {
  const { playerConfig } = version;
  const gltf = useGLTF(avatarAssetUrl(version));
  const root = useRef();
  const model = useMemo(() => cloneSkinned(gltf.scene), [gltf]);
  const { actions, names } = useAnimations(gltf.animations, root);

  useEffect(() => {
    const name = names.find((n) => CLIP.test(n)) ?? names[0];
    const action = name ? actions[name] : null;
    action?.reset().fadeIn(0.15).play();
    return () => void action?.fadeOut(0.1);
  }, [actions, names]);

  useFrame(() => {
    const frozen = !!flight?.dead;
    for (const name of names) if (actions[name]) actions[name].paused = frozen;
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
      <group ref={root} position={playerConfig.offset} scale={playerConfig.scale} rotation={playerConfig.rotation ?? [0, 0, 0]}>
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
