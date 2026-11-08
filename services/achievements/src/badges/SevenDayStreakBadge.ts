import type { UserSnapshot } from '../achievements/UserSnapshot.js';
import type { BadgeMetadata, BadgeRule } from './BadgeRule.js';

/**
 * Unlocks when the user has seven consecutive local dates with at
 * least one logged workout. Reads from the snapshot's `activeDays`
 * window (sorted ascending, no duplicates) so the rule is a pure
 * function of the snapshot.
 *
 * Streak lengthening from freezes is a progress-service concern and
 * does not retroactively grant this badge: a user has to actually
 * train on seven consecutive days.
 */
export class SevenDayStreakBadge implements BadgeRule {
  public static readonly STREAK_LENGTH = 7;

  public readonly metadata: BadgeMetadata = {
    badgeId: 'seven-day-streak',
    name: 'Seven in a row',
    description: 'Trained on seven consecutive days.',
  };

  public shouldUnlock(snapshot: UserSnapshot): boolean {
    const days = snapshot.activeDays;
    if (days.length < SevenDayStreakBadge.STREAK_LENGTH) {
      return false;
    }
    let run = 1;
    for (let i = 1; i < days.length; i += 1) {
      const previous = days[i - 1];
      const current = days[i];
      if (previous === undefined || current === undefined) {
        run = 1;
        continue;
      }
      if (SevenDayStreakBadge.isNextDay(previous, current)) {
        run += 1;
        if (run >= SevenDayStreakBadge.STREAK_LENGTH) {
          return true;
        }
      } else {
        run = 1;
      }
    }
    return false;
  }

  /**
   * True when `b` is exactly one calendar day after `a`. Operates on
   * ISO `YYYY-MM-DD` strings; UTC arithmetic is fine because the
   * snapshot stores local dates already resolved by the producer.
   */
  private static isNextDay(a: string, b: string): boolean {
    const aMs = Date.parse(`${a}T00:00:00Z`);
    const bMs = Date.parse(`${b}T00:00:00Z`);
    if (Number.isNaN(aMs) || Number.isNaN(bMs)) {
      return false;
    }
    return bMs - aMs === 24 * 60 * 60 * 1000;
  }
}
