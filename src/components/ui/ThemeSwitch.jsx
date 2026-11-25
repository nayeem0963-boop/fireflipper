import { useGameStore } from '../../store/useGameStore.js';
import { THEME_LIST } from '../../systems/theme/themes.js';

/**
 * Red / Blue theme switch. `compact` shows just the colour dots (for the top bar); otherwise the names too.
 * Changing theme restyles the interface and the scenery (never the bird's colour); it never touches gameplay.
 */
export default function ThemeSwitch({ compact = false }) {
  const theme = useGameStore((s) => s.theme);
  const setTheme = useGameStore((s) => s.setTheme);
  return (
    <div className={`theme-switch${compact ? ' theme-switch--compact' : ''}`} role="radiogroup" aria-label="Theme">
      {THEME_LIST.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={theme === t.id}
          aria-label={`${t.name} theme (${t.flavour})`}
          title={`${t.name}: ${t.flavour}`}
          className={`theme-switch__btn${theme === t.id ? ' is-active' : ''}`}
          style={{ '--swatch': t.swatch }}
          onClick={() => setTheme(t.id)}
        >
          <span className="theme-switch__dot" aria-hidden="true" />
          {!compact && <span>{t.name}</span>}
        </button>
      ))}
    </div>
  );
}
