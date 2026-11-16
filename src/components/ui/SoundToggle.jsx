import { useGameStore } from '../../store/useGameStore.js';
import IconButton from './IconButton.jsx';
import { SoundOffIcon, SoundOnIcon } from './Icons.jsx';

/** Sound on/off. Persists the preference; no audio is wired up yet. */
export default function SoundToggle() {
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const toggleSound = useGameStore((s) => s.toggleSound);
  return (
    <IconButton label={soundEnabled ? 'Mute sound' : 'Unmute sound'} pressed={soundEnabled} onClick={toggleSound}>
      {soundEnabled ? <SoundOnIcon /> : <SoundOffIcon />}
    </IconButton>
  );
}
