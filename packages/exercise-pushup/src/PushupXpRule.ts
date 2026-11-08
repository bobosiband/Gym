import type { WorkoutEventLike, XpRule } from '@gym/exercise-core';

/**
 * Push-up XP rule: one XP for every ten reps, rounded down.
 *
 * The daily-target bonus (fixed at 50 XP) is applied by the progress
 * service on the event that pushes the day's rep total over the
 * target, not here, because this rule is purely per-event.
 */
export class PushupXpRule implements XpRule {
  public static readonly XP_PER_REPS = 10;

  public baseXp(event: WorkoutEventLike): number {
    return Math.floor(event.reps / PushupXpRule.XP_PER_REPS);
  }
}
