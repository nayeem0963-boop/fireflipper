import { useGameStore, SCREENS } from './store/useGameStore.js';
import HomeScreen from './components/ui/HomeScreen.jsx';
import GameScreen from './components/game/GameScreen.jsx';
import SettingsPanel from './components/ui/SettingsPanel.jsx';
import AvatarPicker from './components/ui/AvatarPicker.jsx';
import AchievementsPanel from './components/ui/AchievementsPanel.jsx';
import CreditsPanel from './components/ui/CreditsPanel.jsx';

/**
 * Top-level screen router. Intentionally thin: screens own their own
 * layout, and all state lives in the Zustand store.
 */
export default function App() {
  const screen = useGameStore((s) => s.screen);
  const settingsOpen = useGameStore((s) => s.settingsOpen);
  const avatarsOpen = useGameStore((s) => s.avatarsOpen);
  const achievementsOpen = useGameStore((s) => s.achievementsOpen);
  const creditsOpen = useGameStore((s) => s.creditsOpen);

  return (
    <>
      {screen === SCREENS.HOME && <HomeScreen />}
      {screen === SCREENS.GAME && <GameScreen />}
      {settingsOpen && <SettingsPanel />}
      {avatarsOpen && <AvatarPicker />}
      {achievementsOpen && <AchievementsPanel />}
      {creditsOpen && <CreditsPanel />}
    </>
  );
}
