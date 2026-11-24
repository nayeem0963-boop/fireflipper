import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Grid, Lightformer, OrbitControls } from '@react-three/drei';
import { BackSide, Color, ShaderMaterial, Vector3 } from 'three';

const DEFAULT_FLOOR_Y = -2.2;

/**
 * Slides the picture sideways or up by `x` / `y` pixels without moving the camera, so the artwork stays centred in the
 * part of the screen the panel leaves free (it would otherwise sit behind the panel). Positive x moves it left.
 */
function ViewShift({ x, y }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useEffect(() => {
    if (!x && !y) {
      camera.clearViewOffset();
      return undefined;
    }
    camera.setViewOffset(size.width, size.height, x, y, size.width, size.height);
    return () => camera.clearViewOffset();
  }, [camera, size.width, size.height, x, y]);
  return null;
}

/** Moves the camera (and the orbit target) smoothly to a preset, and lets go the moment the user grabs the controls. */
function CameraRig({ preset, nonce, controls }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const goal = useRef(null);
  // A tall, narrow screen sees less sideways, so stand back a little (the same idea as the game's portrait camera).
  const aspect = size.width / Math.max(1, size.height);
  const back = aspect < 1 ? 1 + (1 - aspect) * 0.9 : 1;

  useEffect(() => {
    const target = new Vector3(...preset.target);
    const pos = new Vector3(...preset.position);
    goal.current = { pos: target.clone().add(pos.sub(target).multiplyScalar(back)), target, fov: preset.fov };
  }, [preset, nonce, back]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return undefined;
    const release = () => {
      goal.current = null;
    };
    c.addEventListener('start', release);
    return () => c.removeEventListener('start', release);
  }, [controls]);

  useFrame((_, delta) => {
    const g = goal.current;
    const c = controls.current;
    if (!g || !c) return;
    const k = 1 - Math.exp(-5 * Math.min(delta, 0.05));
    camera.position.lerp(g.pos, k);
    c.target.lerp(g.target, k);
    camera.fov += (g.fov - camera.fov) * k;
    camera.updateProjectionMatrix();
    c.update();
    if (camera.position.distanceTo(g.pos) < 0.01 && c.target.distanceTo(g.target) < 0.01 && Math.abs(camera.fov - g.fov) < 0.05) goal.current = null;
  });
  return null;
}

/** A vertical gradient dome (brighter at the horizon) and a floor that fades into it: the studio room. */
function StudioBackdrop({ palette, floorY }) {
  const dome = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uTop: { value: new Color() }, uHorizon: { value: new Color() } },
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        // (A #include line must stand on its own line in GLSL, so this is a multi-line string.)
        fragmentShader: `
          uniform vec3 uTop;
          uniform vec3 uHorizon;
          varying vec3 vDir;
          void main() {
            float h = smoothstep(-0.15, 0.85, vDir.y);
            gl_FragColor = vec4(mix(uHorizon, uTop, h), 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    [],
  );
  useEffect(() => {
    dome.uniforms.uTop.value.set(palette.bg[0]);
    dome.uniforms.uHorizon.value.set(palette.bg[1]);
  }, [dome, palette]);
  useEffect(() => () => dome.dispose(), [dome]);

  return (
    <>
      <fog attach="fog" args={[palette.bg[1], 14, 34]} />
      <mesh material={dome} renderOrder={-10}>
        <sphereGeometry args={[60, 32, 16]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={floorY - 0.01}>
        <circleGeometry args={[40, 64]} />
        <meshStandardMaterial color={palette.bg[1]} roughness={0.55} metalness={0.35} envMapIntensity={0.6} />
      </mesh>
    </>
  );
}

/** Registers a function the HUD calls to save a PNG of the canvas as it is right now. */
function CaptureBridge({ captureRef }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    captureRef.current = () => {
      gl.render(scene, camera); // render, then read in the same task: the drawing buffer is not preserved between frames
      return gl.domElement.toDataURL('image/png');
    };
    return () => {
      captureRef.current = null;
    };
  }, [gl, scene, camera, captureRef]);
  return null;
}

/**
 * The Art Lab scene: studio lighting and a procedural reflection environment (no network fetch), orbit controls with
 * camera presets, optional helpers, and the active art piece, which is given the resolved `params`, the `palette`, a
 * shared `clock` ({ current: { t } }, advanced by the speed setting and stopped by Pause) and the quality tier.
 * `shift` ({ x, y } pixels) keeps the artwork out from behind the panel.
 */
export default function ArtStage({ piece, params, palette, speed, paused, preset, viewNonce, wireframe, grid, axes, studio, quality, captureRef, shift = { x: 0, y: 0 } }) {
  const clock = useRef({ t: 0 });
  const content = useRef();
  const controls = useRef();
  const frames = useRef(0);
  const dark = piece.lighting === 'dark';
  const floorY = piece.floorY ?? DEFAULT_FLOOR_Y;

  // Art time, before the piece reads it (negative priority runs first).
  useFrame((_, delta) => {
    if (!paused) clock.current.t += Math.min(delta, 0.05) * speed;
  }, -100);

  // Wireframe: applied to whatever materials the piece has now (it may load or change them at any time), a few times a second.
  useFrame(() => {
    frames.current += 1;
    if (frames.current % 10 !== 0) return;
    content.current?.traverse((o) => {
      const m = o.material;
      if (m && 'wireframe' in m && m.wireframe !== wireframe) {
        m.wireframe = wireframe;
        m.needsUpdate = true;
      }
    });
  });

  return (
    <>
      <ambientLight intensity={dark ? 0.1 : 0.18} color={palette.light} />
      <directionalLight position={[4, 6, 5]} intensity={dark ? 0.12 : 1.5} color={palette.light} />
      <directionalLight position={[-5, 2, -4]} intensity={dark ? 0.05 : 0.6} color={palette.accent} />

      <Environment key={palette.id} resolution={256} frames={1} environmentIntensity={dark ? 0.65 : 1}>
        <Lightformer form="rect" intensity={3} color={palette.light} position={[0, 4, 4]} scale={[9, 3, 1]} />
        <Lightformer form="ring" intensity={2.2} color={palette.accent} position={[-5, 1, -2]} scale={3} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.6} color={palette.colors[1]} position={[5, -1, 2]} scale={[2, 6, 1]} rotation-y={-Math.PI / 2} />
        <Lightformer form="circle" intensity={2} color={palette.colors[0]} position={[0, -4, -3]} scale={4} rotation-x={Math.PI / 2} />
      </Environment>

      {studio ? <StudioBackdrop palette={palette} floorY={floorY} /> : <color attach="background" args={[palette.bg[0]]} />}
      {grid && (
        <Grid
          position={[0, floorY, 0]}
          args={[40, 40]}
          infiniteGrid
          cellSize={0.5}
          cellThickness={0.6}
          cellColor={palette.colors[3]}
          sectionSize={2.5}
          sectionThickness={1.2}
          sectionColor={palette.accent}
          fadeDistance={24}
        />
      )}
      {axes && <axesHelper args={[2.5]} />}

      <group ref={content}>
        <Suspense fallback={null}>
          <piece.Component params={params} palette={palette} clock={clock} quality={quality} />
        </Suspense>
      </group>

      <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={0.8} maxDistance={32} />
      <CameraRig preset={preset} nonce={viewNonce} controls={controls} />
      <ViewShift x={shift.x} y={shift.y} />
      <CaptureBridge captureRef={captureRef} />
    </>
  );
}
