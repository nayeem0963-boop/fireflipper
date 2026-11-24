import AvatarBird from './AvatarBird.jsx';
import RunnerAvatar from './RunnerAvatar.jsx';
import { useSkin } from '../../hooks/useSkin.js';
import { usesOriginalAvatar } from '../../systems/versions/versions.js';

/**
 * How the player is DRAWN, for a game version (see systems/versions). Nothing here is physics: PlayerBird positions and
 * tilts the group this sits in from the simulation, and the collider lives in the simulation, so the avatar (its model,
 * scale and offset) can change freely without changing a hitbox, a jump or the feel of the game.
 *
 *  - v1 ('v1_original'): the bird and skin the player picked, exactly as the game always drew it.
 *  - v2 ('v2_runner'): the GLB from the version's `playerConfig`, with the v1 bird standing in until it loads.
 *
 * Props:
 *  - version:     a GameVersion
 *  - playerState: the live flight state { vy, sinceFlap, dead, ... } from the simulation (read-only; omit for a preview)
 *  - sizeFactor:  multiplies the configured scale (menu previews are drawn larger than the in-game player)
 *  - the rest (rotation, float, wingSpeed, lightIntensity, glow) go to the avatar as they do to AvatarBird
 */
export default function PlayerAvatar({ version, playerState, sizeFactor = 1, ...props }) {
  const skin = useSkin();
  const { scale, offset } = version.playerConfig;
  const sized = scale.map((s) => s * sizeFactor);

  const original = <AvatarBird avatar={skin} scale={sized} position={offset} flight={playerState} {...props} />;
  if (usesOriginalAvatar(version)) return original;

  const { rotation: faceYaw, ...rest } = props;
  return (
    <RunnerAvatar
      version={version}
      flight={playerState}
      fallback={original}
      scale={sized.map((s, i) => s / scale[i])}
      rotation={faceYaw}
      {...rest}
    />
  );
}
