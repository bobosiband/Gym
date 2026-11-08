import type { UserSnapshot } from '../achievements/UserSnapshot.js';
import type { BadgeMetadata, BadgeRule } from './BadgeRule.js';

/**
 * Unlocks on the user's first logged workout of any kind.
 */
export class FirstWorkoutBadge implements BadgeRule {
  public readonly metadata: BadgeMetadata = {
    badgeId: 'first-workout',
    name: 'First rep down',
    description: 'Logged your first workout.',
  };

  public shouldUnlock(snapshot: UserSnapshot): boolean {
    return snapshot.totalWorkouts >= 1;
  }
}
