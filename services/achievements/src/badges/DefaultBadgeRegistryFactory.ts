import { BadgeRegistry } from './BadgeRegistry.js';
import { FirstWorkoutBadge } from './FirstWorkoutBadge.js';
import { Level5Badge } from './Level5Badge.js';
import { SevenDayStreakBadge } from './SevenDayStreakBadge.js';
import { TotalReps100Badge } from './TotalReps100Badge.js';

/**
 * Builds the default {@link BadgeRegistry} shipped with the service.
 * Adding a new badge is a new file in this folder plus one line here.
 */
export class DefaultBadgeRegistryFactory {
  private constructor() {
    // utility class; never instantiated
  }

  public static create(): BadgeRegistry {
    const registry = new BadgeRegistry();
    registry.register(new FirstWorkoutBadge());
    registry.register(new TotalReps100Badge());
    registry.register(new SevenDayStreakBadge());
    registry.register(new Level5Badge());
    return registry;
  }
}
