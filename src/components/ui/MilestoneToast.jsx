import { useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore.js';
import { getReward } from '../../systems/rewards/rewards.js';
import '../../styles/journey.css';

/** How long a milestone banner stays (ms). */
export const TOAST_MS = 3600;

/**
 * A compact "World completed" banner for the first four milestones. It sits under the HUD, ignores the pointer (taps fall through to the play surface), never pauses or
 * slows anything and removes itself; one banner at a time, so nothing piles up. Driven by the store's `milestone` (set when the simulation announces a survived border).
 */
export default function MilestoneToast() {
  const milestone = useGameStore((s) => s.milestone);
  const clear = useGameStore((s) => s.clearMilestone);

  useEffect(() => {
    if (!milestone) return undefined;
    const id = setTimeout(clear, TOAST_MS);
    return () => clearTimeout(id);
  }, [milestone, clear]);

  if (!milestone) return null;
  const rewards = milestone.granted.map((id) => getReward(id)?.name).filter(Boolean);
  return (
    <div className="mtoast" role="status" aria-live="polite" key={milestone.id}>
      <span className="mtoast__star" aria-hidden="true">✦</span>
      <div className="mtoast__text">
        <p className="mtoast__kicker">World {milestone.index + 1} completed</p>
        <p className="mtoast__name">{milestone.name}</p>
        {rewards.length > 0 && <p className="mtoast__reward">{rewards.join(' · ')} unlocked</p>}
      </div>
    </div>
  );
}
