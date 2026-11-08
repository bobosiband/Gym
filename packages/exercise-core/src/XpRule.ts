import type { WorkoutEventLike } from './WorkoutEventLike.js';

/**
 * Strategy that turns a single event for one exercise into a base XP
 * amount. Daily-target bonuses are computed separately by the
 * progress service so an {@link XpRule} is purely per-event.
 *
 * Implementations live next to the exercise they score (for example
 * `packages/exercise-pushup/src/PushupXpRule.ts`). New exercises
 * ship their own class; nothing in this package is edited.
 */
export interface XpRule {
  /**
   * Base XP earned for this event. Must be a non-negative integer.
   * Returns `0` when the event does not earn XP under this rule.
   */
  baseXp(event: WorkoutEventLike): number;
}
