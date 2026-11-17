import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  AdditiveBlending,
  AnimationMixer,
  BackSide,
  Color,
  DataTexture,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  RGBAFormat,
  SkinnedMesh,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { getGlowTexture } from '../../utils/textures.js';
import { STROKE_TIME } from './PlaceholderFirebird.jsx';

export const EAGLE_URL = `${import.meta.env.BASE_URL}models/eagle.glb`;

/**
 * The GLB fire eagle (see public/models/CREDITS.md). The source model is a
 * grey-and-brown bald eagle with a rigged "Fly" clip; here it is re-skinned
 * at runtime into a blazing firebird:
 *
 *  - the 8-texel palette texture is swapped for a fire palette, with a
 *    matching emissive map so the bird glows from within;
 *  - a flicker/rim-light patch on the standard material adds heat shimmer;
 *  - a skinned "flame shell" (back faces, additive) is pushed out along the
 *    normals and licks backwards like a trailing flame;
 *  - glow sprites follow the wing tips, tail tip and crest.
 *
 * It faces +X like the placeholder bird and takes the same props.
 */

const MODEL_SCALE = 0.95; // eagle body ≈ the primitive bird's body
const FLIGHT_PITCH = -0.62; // the source pose is perched and upright; lean it into a dive-ready glide
const WING_SCALE = 1.7; // the source wings are tiny; make them read in profile

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Texel order matches the source palette: 0 pale, 1 body, 2 wing, 3 beak,
// 4 feet, 5 pale, 6 head, 7 eye.
const FIRE_PALETTE = ['#ffc04a', '#e83a08', '#a51402', '#fff0a0', '#ffa72a', '#ffd070', '#ffe9a8', '#1b0804'];
// How strongly each texel glows (eyes stay dark so the bird keeps a face).
const GLOW_PALETTE = ['#ffffff', '#ff9a6a', '#ff5a2a', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#000000'];

function paletteTexture(hexes, srgb = true) {
  const data = new Uint8Array(hexes.length * 4);
  const c = new Color();
  hexes.forEach((hex, i) => {
    c.set(hex);
    // Color.set() converts the hex to linear working space; textures are
    // authored in sRGB, so convert back before writing bytes.
    c.convertLinearToSRGB();
    data.set([c.r * 255, c.g * 255, c.b * 255, 255], i * 4);
  });
  const tex = new DataTexture(data, hexes.length, 1, RGBAFormat);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  if (srgb) tex.colorSpace = SRGBColorSpace;
  tex.flipY = false; // glTF UV convention
  tex.needsUpdate = true;
  return tex;
}

function createFireMaterial(uTime) {
  const mat = new MeshStandardMaterial({
    map: paletteTexture(FIRE_PALETTE),
    emissiveMap: paletteTexture(GLOW_PALETTE),
    emissive: new Color('#ff7a2a'),
    emissiveIntensity: 0.8,
    roughness: 0.55,
    metalness: 0,
    toneMapped: false,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;\nuniform float uTime;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        // Heat shimmer rolling from head to tail, plus a hot rim on the silhouette.
        float wave = 0.5 + 0.5 * sin(vObj.z * 6.0 + vObj.y * 4.0 - uTime * 6.0);
        float shimmer = 0.78 + 0.5 * wave * (0.6 + 0.4 * sin(vObj.x * 9.0 + uTime * 3.7));
        float rim = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 2.4);
        totalEmissiveRadiance = totalEmissiveRadiance * shimmer + vec3(1.0, 0.5, 0.1) * rim * 1.5;`,
      );
  };
  return mat;
}

/** Back-face additive shell that grows along normals and streams backwards like flame. */
function createFlameShellMaterial(uTime) {
  const mat = new MeshBasicMaterial({
    side: BackSide,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vBack;')
      .replace(
        '#include <skinning_vertex>',
        `#include <skinning_vertex>
        // Model faces +Z in object space, so the tail is toward -Z.
        float back = smoothstep(0.5, -1.7, position.z);
        float lick = 0.5 + 0.5 * sin(position.z * 5.0 - uTime * 9.0 + position.x * 6.0);
        float jitter = 0.02 * sin(uTime * 13.0 + position.y * 8.0);
        vBack = back;
        transformed += normalize(objectNormal) * (0.04 + back * 0.17 * lick + jitter);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vBack;')
      .replace(
        '#include <opaque_fragment>',
        `vec3 flame = mix(vec3(1.0, 0.72, 0.2), vec3(1.0, 0.16, 0.02), vBack);
        gl_FragColor = vec4(flame, mix(0.5, 0.28, vBack));`,
      );
  };
  return mat;
}

/** Picks the vertex that maximizes score() among those mostly bound to `boneIndex`. */
function pickVertex(mesh, boneIndex, score) {
  const pos = mesh.geometry.attributes.position;
  const joints = mesh.geometry.attributes.skinIndex;
  const weights = mesh.geometry.attributes.skinWeight;
  const v = new Vector3();
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    if (boneIndex !== null) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (joints.getComponent(i, k) === boneIndex) w += weights.getComponent(i, k);
      if (w < 0.5) continue;
    }
    v.fromBufferAttribute(pos, i);
    const s = score(v);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  }
  return best;
}

export default function FireEagle({ float = 0.12, wingSpeed = 7, glow = 0.55, lightIntensity = 6, flight, ...props }) {
  const gltf = useGLTF(EAGLE_URL);
  const root = useRef();
  const halo = useRef();
  const pivot = useRef();
  const flames = useRef([]);
  const phase = useRef(0);
  const clipTime = useRef(0);

  const glowMap = useMemo(getGlowTexture, []);
  const uTime = useMemo(() => ({ value: 0 }), []);

  const rig = useMemo(() => {
    const scene = cloneSkinned(gltf.scene);
    const mesh = scene.getObjectByProperty('isSkinnedMesh', true);
    const bones = mesh.skeleton.bones;
    const idx = (name) => bones.findIndex((b) => b.name === name);

    mesh.material = createFireMaterial(uTime);
    mesh.frustumCulled = false;

    const shell = new SkinnedMesh(mesh.geometry, createFlameShellMaterial(uTime));
    shell.position.copy(mesh.position);
    shell.quaternion.copy(mesh.quaternion);
    shell.scale.copy(mesh.scale);
    mesh.parent.add(shell);
    shell.bind(mesh.skeleton, mesh.bindMatrix);
    shell.frustumCulled = false;
    shell.renderOrder = 1;

    // Anchor vertices the glow sprites follow, found once on the rest pose.
    const anchors = [
      { v: pickVertex(mesh, idx('wingL'), (p) => -p.x), size: 1.5, color: '#ff8a2a', op: 0.7 },
      { v: pickVertex(mesh, idx('wingR'), (p) => p.x), size: 1.5, color: '#ff8a2a', op: 0.7 },
      { v: pickVertex(mesh, null, (p) => -p.z), size: 2.1, color: '#ff6a18', op: 0.8 }, // tail tip
      { v: pickVertex(mesh, idx('hair02'), (p) => p.y), size: 1.1, color: '#ffd27a', op: 0.85 }, // crest
    ];

    const body = bones.find((b) => b.name === 'body');
    scene.updateMatrixWorld(true);
    const center = body.getWorldPosition(new Vector3());

    return { scene, mesh, anchors, center, wingBones: [bones[idx('wingL')], bones[idx('wingR')]] };
  }, [gltf, uTime]);

  const mixer = useMemo(() => {
    const m = new AnimationMixer(rig.scene);
    const action = m.clipAction(gltf.animations[0]);
    action.play();
    action.paused = true; // time is driven by hand
    return { m, action, duration: gltf.animations[0].duration };
  }, [rig, gltf]);

  useLayoutEffect(() => {
    // Anchor sprites live in the pivot group's space.
    const g = pivot.current;
    flames.current = rig.anchors.map((a) => {
      const s = g.children.find((c) => c.userData.anchor === a);
      return s;
    });
  }, [rig]);

  useEffect(
    () => () => {
      mixer.m.stopAllAction();
      rig.mesh.material.map?.dispose();
      rig.mesh.material.emissiveMap?.dispose();
      rig.mesh.material.dispose();
    },
    [mixer, rig],
  );

  const tmp = useMemo(() => new Vector3(), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    uTime.value = t;

    // --- wing animation -------------------------------------------------
    let pose;
    let beat;
    if (flight) {
      const tuck = flight.dead ? 0 : clamp01((-flight.vy - 5) / 7);
      phase.current += dt * wingSpeed * (1 - tuck * 0.6);
      beat = Math.sin(phase.current);
      if (flight.dead) pose = 0.5;
      else if (flight.sinceFlap < STROKE_TIME) pose = flight.sinceFlap / STROKE_TIME;
      else pose = (phase.current / (Math.PI * 2)) % 1;
      if (!flight.dead && flight.sinceFlap >= STROKE_TIME && tuck > 0) pose = pose * (1 - tuck) + 0.6 * tuck;
      if (halo.current) {
        const target = flight.dead ? glow * 0.35 : glow;
        halo.current.opacity += (target - halo.current.opacity) * (1 - Math.exp(-4 * dt));
      }
    } else {
      phase.current += dt * wingSpeed;
      beat = Math.sin(phase.current);
      pose = (phase.current / (Math.PI * 2)) % 1;
    }
    clipTime.current += (pose - clipTime.current) * (flight ? 1 : 1);
    mixer.action.time = clipTime.current * mixer.duration;
    mixer.m.update(0);
    rig.wingBones.forEach((b) => b.scale.setScalar(WING_SCALE));

    // --- whole-body bob/sway ---------------------------------------------
    if (root.current) {
      root.current.position.y = Math.sin(t * 1.6) * float - beat * 0.03;
      root.current.rotation.z = Math.sin(t * 1.1) * 0.06 + (flight?.dead ? -0.3 : 0);
      root.current.rotation.x = Math.sin(t * 0.8) * 0.04;
    }

    // --- glow sprites pinned to anchor vertices ----------------------------
    const g = pivot.current;
    if (g) {
      g.updateMatrixWorld(true);
      rig.anchors.forEach((a, i) => {
        const sprite = flames.current[i];
        if (!sprite) return;
        rig.mesh.getVertexPosition(a.v, tmp); // skinned, in mesh space
        rig.mesh.localToWorld(tmp);
        g.worldToLocal(tmp);
        sprite.position.copy(tmp);
        const flick = 1 + Math.sin(t * 14 + i * 1.7) * 0.12 + Math.sin(t * 23 + i) * 0.07;
        const k = a.size * flick * (flight?.dead ? 0.4 : 1);
        sprite.scale.set(k, k, 1);
      });
    }
  });

  return (
    <group {...props}>
      <group ref={root}>
        <pointLight color="#ff7a2a" intensity={lightIntensity} distance={8} decay={1.6} position={[0.2, 0.3, 0.8]} />

        {/* Halo */}
        <sprite scale={[4.6, 4.6, 1]} renderOrder={-1}>
          <spriteMaterial
            ref={halo}
            map={glowMap}
            color="#ff7a24"
            transparent
            opacity={glow}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </sprite>

        {/* The model faces +Z; turn it to face +X and centre the body on the origin. */}
        <group rotation={[0, 0, FLIGHT_PITCH]}>
        <group rotation={[0, Math.PI / 2, 0]} scale={MODEL_SCALE}>
          <group ref={pivot}>
            <group position={[-rig.center.x, -rig.center.y, -rig.center.z]}>
              <primitive object={rig.scene} />
            </group>
            {rig.anchors.map((a, i) => (
              <sprite key={i} userData={{ anchor: a }} renderOrder={2}>
                <spriteMaterial
                  map={glowMap}
                  color={a.color}
                  transparent
                  opacity={a.op}
                  depthWrite={false}
                  blending={AdditiveBlending}
                  toneMapped={false}
                />
              </sprite>
            ))}
          </group>
        </group>
        </group>
      </group>
    </group>
  );
}

useGLTF.preload(EAGLE_URL);
