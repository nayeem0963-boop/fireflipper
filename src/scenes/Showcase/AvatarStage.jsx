import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import AvatarBird from '../../components/scene/AvatarBird.jsx';

/** A small stage for previewing one avatar in the picker: the bird side-on, as it flies in the game, swaying gently. */
export default function AvatarStage({ avatar }) {
  const group = useRef();
  useFrame((state) => {
    if (group.current) group.current.rotation.y = -0.25 + Math.sin(state.clock.elapsedTime * 0.7) * 0.35;
  });
  return (
    <>
      <ambientLight intensity={0.35} color="#ffb27a" />
      <hemisphereLight args={['#ff9a4a', '#120805', 0.6]} />
      <directionalLight position={[-4, 5, 3]} intensity={1.1} color="#ffd2a0" />
      <group ref={group}>
        <AvatarBird avatar={avatar} float={0.14} wingSpeed={5.5} />
      </group>
    </>
  );
}
