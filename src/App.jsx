import { lazy, Suspense } from 'react';
import { useGameStore, SCREENS } from './store/useGameStore.js';
import HomeScreen from './components/ui/HomeScreen.jsx';
import SettingsPanel from './components/ui/SettingsPanel.jsx';
import LeaderboardPanel from './components/ui/LeaderboardPanel.jsx';

// The game screen pulls in the whole simulation + 3D scene, so load it on first Play.
const GameScreen = lazy(() => import('./components/game/GameScreen.jsx'));

/**
 * Top-level screen router. Intentionally thin: screens own their own
 * layout, and all state lives in the Zustand store.
 */
export default function App() {
  const screen = useGameStore((s) => s.screen);
  const settingsOpen = useGameStore((s) => s.settingsOpen);
  const leaderboardOpen = useGameStore((s) => s.leaderboardOpen);

  return (
    <>
      {screen === SCREENS.HOME && <HomeScreen />}
      {screen === SCREENS.GAME && (
        <Suspense fallback={null}>
          <GameScreen />
        </Suspense>
      )}
      {settingsOpen && <SettingsPanel />}
      {leaderboardOpen && <LeaderboardPanel />}
    </>
  );
}
