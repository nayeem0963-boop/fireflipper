import { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore.js';
import { REWARDS, howToEarn, ownedCount, owns } from '../../systems/rewards/rewards.js';
import { WORLD_COUNT } from '../../systems/world/worlds.js';
import { avatarFor, getAvatar } from '../../systems/avatars/avatars.js';
import { FREE_COLOR } from '../../systems/skins/skins.js';
import { useTheme } from '../../hooks/useTheme.js';
import IconButton from './IconButton.jsx';
import { CloseIcon } from './Icons.jsx';
import RewardArt from './RewardArt.jsx';
import '../../styles/panel.css';
import '../../styles/journey.css';

/**
 * The reward collection: the five journey rewards, unlocked or locked, with what each is and how it is earned, and the journey's progress. A display only: nothing here grants a
 * reward (the store does, when the simulation announces a milestone), so opening this screen unlocks nothing. The one action is equipping the Celestial Bird Skin once it is owned.
 */
export default function RewardsPanel() {
  const close = useGameStore((s) => s.closeRewards);
  const journey = useGameStore((s) => s.journey);
  const skinId = useGameStore((s) => s.skinId);
  const selectSkin = useGameStore((s) => s.selectSkin);
  const theme = useTheme();
  const dialog = useRef(null);

  useEffect(() => {
    dialog.current?.focus();
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const owned = ownedCount(journey);
  const worldsReached = journey.milestones.filter((n) => n > 0).length;
  const wearing = getAvatar(skinId).id === 'flipper-celestial';

  return (
    <div className="overlay overlay--journey" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="panel rwd" role="dialog" aria-modal="true" aria-labelledby="rwd-title" tabIndex={-1} ref={dialog}>
        <header className="rwd__header">
          <div>
            <h2 id="rwd-title" className="rwd__title">Journey Rewards</h2>
            <p className="rwd__edition">Journey to the Celestial City</p>
          </div>
          <span className="rwd__count" aria-label={`${owned} of ${REWARDS.length} rewards unlocked`}>{owned}/{REWARDS.length}</span>
          <IconButton label="Close" onClick={close}>
            <CloseIcon />
          </IconButton>
        </header>

        <div className="rwd__progress" aria-hidden="true">
          <i style={{ width: `${(owned / REWARDS.length) * 100}%` }} />
        </div>

        <ul className="rwd__grid">
          {REWARDS.map((r) => {
            const has = owns(journey, r.id);
            return (
              <li key={r.id} className={`rcard rcard--${r.rarity.id}${has ? ' is-owned' : ' is-locked'}${r.primary ? ' is-primary' : ''}`}>
                <div className="rcard__art">
                  <RewardArt id={r.id} locked={!has} />
                  {!has && <span className="rcard__lock" aria-hidden="true">🔒</span>}
                </div>
                <div className="rcard__text">
                  <p className="rcard__rarity">{r.rarity.name}</p>
                  <h3 className="rcard__name">{r.name}</h3>
                  <p className="rcard__kicker">{r.kicker}</p>
                  <p className="rcard__desc">{has ? r.desc : 'Locked'}</p>
                  <p className="rcard__how">{has ? 'Unlocked' : howToEarn(r)}</p>
                  {r.id === 'celestial-skin' && has && (
                    <button
                      type="button"
                      className="ghost-btn rcard__equip"
                      onClick={() => selectSkin(wearing ? avatarFor('bulbuli', FREE_COLOR).id : 'flipper-celestial')}
                    >
                      {wearing ? 'Unequip' : 'Equip skin'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <footer className="rwd__footer">
          <p className="rwd__note">
            Worlds reached {worldsReached}/{WORLD_COUNT} · Journeys completed {journey.completions}
          </p>
          <button type="button" className="play-btn play-btn--compact" onClick={close}>Done</button>
        </footer>
      </div>
    </div>
  );
}
