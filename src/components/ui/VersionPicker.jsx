import { useGameStore } from '../../store/useGameStore.js';
import { GAMES_CONFIG } from '../../systems/versions/versions.js';
import '../../styles/versions.css';

/**
 * Chooses the game version on the menu: v1 (Original) or v2 (New Runner). Switching is instant (no reload) and is kept in
 * storage and in the address bar (?version=v2), so a link opens straight into a version. Both versions are the same game;
 * only the player's avatar differs.
 */
export default function VersionPicker() {
  const versionId = useGameStore((s) => s.versionId);
  const selectVersion = useGameStore((s) => s.selectVersion);

  return (
    <div className="versions" role="radiogroup" aria-label="Choose game version">
      {GAMES_CONFIG.map((v) => {
        const active = v.id === versionId;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`versioncard${active ? ' is-active' : ''}`}
            onClick={() => selectVersion(v.id)}
          >
            {v.thumbnail && (
              <img
                className="versioncard__thumb"
                src={`${import.meta.env.BASE_URL}${v.thumbnail.replace(/^\/+/, '')}`}
                alt=""
                loading="lazy"
              />
            )}
            <span className="versioncard__text">
              <span className="versioncard__title">{v.title}</span>
              <small className="versioncard__desc">{v.description}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
