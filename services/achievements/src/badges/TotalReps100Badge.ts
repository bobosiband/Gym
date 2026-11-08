import type { UserSnapshot } from '../achievements/UserSnapshot.js';
import type { BadgeMetadata, BadgeRule } from './BadgeRule.js';

/**
 * Unlocks when the user has logged a total of 100 reps across any
 * combination of exercises.
 */
export class TotalReps100Badge implements BadgeRule {
  public static readonly THRESHOLD = 100;

  public readonly metadata: BadgeMetadata = {
    badgeId: 'total-reps-100',
    name: 'Century club',
    description: 'Logged 100 total reps across any exercise.',
  };

  public shouldUnlock(snapshot: UserSnapshot): boolean {
    return snapshot.totalReps >= TotalReps100Badge.THRESHOLD;
  }
}
