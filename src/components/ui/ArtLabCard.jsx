import { useGameStore } from '../../store/useGameStore.js';
import { ArtIcon } from './Icons.jsx';
import '../../styles/artcard.css';

/**
 * The Art Lab's entry on the menu, shown beside the version picker (v1 / v2) as a third card. It is not a game version:
 * it opens a separate 3D art playground with no score, so it is a plain button, not a radio in the version group.
 */
export default function ArtLabCard() {
  const openArt = useGameStore((s) => s.openArt);
  return (
    <button type="button" className="versioncard artcard" onClick={openArt}>
      <span className="artcard__icon" aria-hidden="true">
        <ArtIcon />
      </span>
      <span className="versioncard__text">
        <span className="versioncard__title">Art Lab</span>
        <small className="versioncard__desc">A 3D art playground. No score.</small>
      </span>
    </button>
  );
}
