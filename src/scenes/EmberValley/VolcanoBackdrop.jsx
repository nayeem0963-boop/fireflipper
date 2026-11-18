import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, Color, Object3D, SRGBColorSpace, TextureLoader } from 'three';
import { WORLD } from '../../systems/physics/constants.js';
import { BIOMES, zoneWeight } from '../../systems/world/biomes.js';
import { createCoastShoreTexture, createCoastWaterTexture } from './valleyTextures.js';
import { createCoastRocks } from './mangroveGeometry.js';

const Z = BIOMES.volcano;
const S = Z.scene;
const GROUND_WIDTH = 200;
const GROUND_REPEAT = 50; // 4 world units per tile
/**
 * Where the painted horizon band stands: just in front of the base scenery's opaque sky plane (z = -60), so it is not hidden by it, and
 * with its bottom edge on the sea's horizon (the floor, drawn over it, covers the last few pixels).
 */
const BAND_Z = -59;
/** The three paintings, in the order they appear (volcano; volcano and snow-capped range; sandstone buttes on the shore). */
const PAINTINGS = ['coast-a.jpg', 'coast-b.jpg', 'coast-c.jpg'];
/** Aspect of a cropped painting band (1600 x 370). */
const ASPECT = 1600 / 370;
/** Sideways drift of the paintings in world units per metre travelled (a far backdrop: slower than the mid layers). */
const PAN = 0.036;
/** Where each next painting dissolves in over the one before it (metres), and over how long. */
const CUTS = [660, 820];
const DISSOLVE = 30;
/** The painting loads when the player gets this close, so the first screens of the game never wait for it. */
const PRELOAD_AT = 380;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Deterministic pseudo-random so layouts are stable across renders. */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * The Volcanic Coast scenery for 500 to 1000 m. The far scenery is the three coast paintings (public/images/backdrop), each cropped
 * to its sky-and-horizon band, scaled to the view, and dissolved one into the next as you fly; the sea, the sandy shore and the
 * rock islands are 3D, matched to the paintings' colours, so the horizon joins up and the scenery still has depth and parallax.
 * It cross-fades with the Sundarbans (around 500 m) and the Amazon (around 1000 m) and is hidden outside that, so it costs nothing
 * elsewhere. Purely visual: nothing here touches the simulation.
 */
export default function VolcanoBackdrop({ sim }) {
  const root = useRef();
  const wRef = useRef(0);
  return (
    <group ref={root} name="volcano" visible={false}>
      <Sky wRef={wRef} />
      <Paintings sim={sim} wRef={wRef} />
      <Sea sim={sim} wRef={wRef} />
      <Shore sim={sim} wRef={wRef} />
      <Islands sim={sim} wRef={wRef} depth={-31} scale={2.0} count={6} span={170} speedFactor={0.3} seed={4} tint="#c9d2c8" />
      <Islands sim={sim} wRef={wRef} depth={-17} scale={0.95} count={5} span={104} speedFactor={0.55} seed={12} tint="#ffffff" />
      <WeightDriver sim={sim} wRef={wRef} groupRef={root} />
    </group>
  );
}

/** Computes the zone's weight once per frame for every part, and hides the whole group once it is gone. */
function WeightDriver({ sim, wRef, groupRef }) {
  useFrame(() => {
    const w = zoneWeight(Z, sim.renderDistance());
    wRef.current = w;
    if (groupRef.current) groupRef.current.visible = w > 0.001;
  }, -1);
  return null;
}

function createSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, S.skyTop);
  g.addColorStop(0.55, S.skyTop);
  g.addColorStop(1, S.skyMid);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** A vertical fade from the sky colour (opaque at the top) to nothing, laid over the top edge of a painting so it melts into the sky. */
function createTopFadeTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(175,218,217,1)');
  g.addColorStop(1, 'rgba(175,218,217,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 64);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function Sky({ wRef }) {
  const mat = useRef();
  const tex = useMemo(createSkyTexture, []);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame(() => {
    if (mat.current) mat.current.opacity = Math.min(1, wRef.current * 1.6);
  });
  return (
    <mesh position={[0, 8, -58]} renderOrder={-3}>
      <planeGeometry args={[400, 60]} />
      <meshBasicMaterial ref={mat} map={tex} transparent fog={false} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

/**
 * The three paintings as unlit billboards behind everything. Each is sized from the camera every frame so it always covers the
 * view (and stays a sensible size on a tall phone screen), drifts slowly sideways as you fly, and fades in over the one before.
 */
function Paintings({ sim, wRef }) {
  const meshes = useRef([]);
  const mats = useRef([]);
  const fade = useRef();
  const fadeMat = useRef();
  const state = useRef({ started: false, textures: [] });
  const fadeTex = useMemo(createTopFadeTexture, []);
  useEffect(
    () => () => {
      fadeTex.dispose();
      state.current.textures.forEach((t) => t?.dispose());
    },
    [fadeTex],
  );

  const load = () => {
    state.current.started = true;
    const loader = new TextureLoader();
    const base = import.meta.env?.BASE_URL ?? '/';
    PAINTINGS.forEach((file, i) => {
      loader.load(
        `${base}images/backdrop/${file}`,
        (tex) => {
          tex.colorSpace = SRGBColorSpace;
          tex.anisotropy = 4;
          state.current.textures[i] = tex;
          const m = mats.current[i];
          if (m) {
            m.map = tex;
            m.needsUpdate = true;
          }
        },
        undefined,
        () => {}, // a missing painting just leaves the sky gradient and the 3D sea
      );
    });
  };

  useFrame((frame) => {
    const d = sim.renderDistance();
    if (!state.current.started && d > PRELOAD_AT) load();
    const w = wRef.current;
    if (w <= 0.001) return;
    const cam = frame.camera;
    const fov = (cam.fov * Math.PI) / 180;
    const dist = cam.position.z - BAND_Z;
    const viewH = 2 * dist * Math.tan(fov / 2);
    const viewW = viewH * cam.aspect;
    // Large enough to cover the view and reach the sky, but on a tall (portrait) screen no more than ~2.6 views wide, so the volcano stays in frame.
    const needH = cam.position.y - WORLD.groundY + viewH * 0.58;
    const W = Math.max(viewW * 1.12, Math.min(needH * ASPECT, viewW * 2.6));
    const H = W / ASPECT;
    const slack = (W - viewW) / 2;
    const x = cam.position.x + clamp(slack - (d - Z.start) * PAN, -slack, slack);
    const y = WORLD.groundY + H / 2 - 0.05;

    const alpha = [w, w * smooth(CUTS[0] - DISSOLVE / 2, CUTS[0] + DISSOLVE / 2, d), w * smooth(CUTS[1] - DISSOLVE / 2, CUTS[1] + DISSOLVE / 2, d)];
    meshes.current.forEach((m, i) => {
      if (!m) return;
      const ready = !!mats.current[i]?.map;
      m.visible = ready && alpha[i] > 0.002;
      if (!m.visible) return;
      m.position.set(x, y, BAND_Z);
      m.scale.set(W, H, 1);
      mats.current[i].opacity = Math.min(1, alpha[i] * 1.5);
    });
    if (fade.current) {
      const anyReady = mats.current.some((m) => m?.map);
      fade.current.visible = anyReady;
      fade.current.position.set(x, WORLD.groundY + H * 0.91, BAND_Z + 0.01);
      fade.current.scale.set(W, H * 0.18, 1);
      if (fadeMat.current) fadeMat.current.opacity = Math.min(1, w * 1.5);
    }
  });

  return (
    <>
      {PAINTINGS.map((file, i) => (
        <mesh key={file} ref={(m) => (meshes.current[i] = m)} renderOrder={-2} visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial ref={(m) => (mats.current[i] = m)} transparent opacity={0} depthWrite={false} fog={false} toneMapped={false} />
        </mesh>
      ))}
      <mesh ref={fade} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={fadeMat} map={fadeTex} transparent opacity={0} depthWrite={false} fog={false} toneMapped={false} />
      </mesh>
    </>
  );
}

/** The sea: a faceted jade floor, scrolled with the track, fading in with the zone. */
function Sea({ sim, wRef }) {
  const mesh = useRef();
  const mat = useRef();
  const tex = useMemo(() => {
    const t = createCoastWaterTexture(S);
    t.repeat.set(GROUND_REPEAT, 25);
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame((state) => {
    tex.offset.x = (sim.renderDistance() / (GROUND_WIDTH / GROUND_REPEAT)) % 1;
    if (mesh.current) mesh.current.position.x = state.camera.position.x;
    if (mat.current) mat.current.opacity = Math.min(1, wRef.current * 2);
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, WORLD.groundY + 0.03, -30]}>
      <planeGeometry args={[GROUND_WIDTH, 100]} />
      <meshStandardMaterial ref={mat} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.5} roughness={0.8} transparent depthWrite={false} />
    </mesh>
  );
}

/** The sandy shore, laid over the sea's far side from about 760 m so the last stretch ends on a beach under the buttes. */
function Shore({ sim, wRef }) {
  const mesh = useRef();
  const mat = useRef();
  const tex = useMemo(() => {
    const t = createCoastShoreTexture(S);
    t.repeat.set(GROUND_REPEAT, 1);
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame((state) => {
    const d = sim.renderDistance();
    tex.offset.x = (d / (GROUND_WIDTH / GROUND_REPEAT)) % 1;
    const k = smooth(760, 860, d);
    if (mesh.current) {
      mesh.current.position.x = state.camera.position.x;
      mesh.current.visible = k > 0.002;
    }
    if (mat.current) mat.current.opacity = Math.min(1, wRef.current * 2) * k;
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, WORLD.groundY + 0.04, -30]} visible={false}>
      <planeGeometry args={[GROUND_WIDTH, 100]} />
      <meshStandardMaterial ref={mat} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.5} roughness={0.9} transparent depthWrite={false} />
    </mesh>
  );
}

/** A layer of boulder islands standing in the sea behind the flight plane: one instanced mesh, scrolling at its own parallax speed. */
function Islands({ sim, wRef, depth, scale, count, span, speedFactor, seed, tint }) {
  const mesh = useRef();
  const dummy = useMemo(() => new Object3D(), []);
  const geometry = useMemo(() => createCoastRocks(S.rock), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const items = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: count }, (_, i) => ({
      x: (i / count) * span - span / 2 + rand() * (span / count) * 0.7,
      s: scale * (0.6 + rand() * 0.8),
      dz: (rand() - 0.5) * 3,
      rot: rand() * Math.PI * 2,
      shade: 0.85 + rand() * 0.25,
    }));
  }, [count, scale, seed, span]);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const base = new Color(tint);
    const c = new Color();
    items.forEach((it, i) => m.setColorAt(i, c.copy(base).multiplyScalar(it.shade)));
    m.instanceColor.needsUpdate = true;
  }, [items, tint]);
  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const grow = Math.max(0.0001, wRef.current);
    const camX = state.camera.position.x;
    const offset = (sim.renderDistance() * speedFactor) % span;
    items.forEach((it, i) => {
      let x = it.x - offset;
      if (x < -span / 2) x += span;
      dummy.position.set(x + camX, WORLD.groundY, it.dz);
      dummy.rotation.set(0, it.rot, 0);
      dummy.scale.set(it.s, it.s * grow, it.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <group position={[0, 0, depth]}>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial vertexColors flatShading roughness={1} />
      </instancedMesh>
    </group>
  );
}
