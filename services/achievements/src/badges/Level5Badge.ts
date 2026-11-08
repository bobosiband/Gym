import type { UserSnapshot } from '../achievements/UserSnapshot.js';
import type { BadgeMetadata, BadgeRule } from './BadgeRule.js';

/**
 * Unlocks when the user reaches level 5 (per the progress service's
 * level curve). The snapshot stores `highestLevel` which is the
 * largest `newLevel` seen in any `progress.level_up.v1` event.
 */
export class Level5Badge implements BadgeRule {
  public static readonly THRESHOLD = 5;

  public readonly metadata: BadgeMetadata = {
    badgeId: 'level-5',
    name: 'High five',
    description: 'Reached level 5.',
  };

  public shouldUnlock(snapshot: UserSnapshot): boolean {
    return snapshot.highestLevel >= Level5Badge.THRESHOLD;
  }
}
