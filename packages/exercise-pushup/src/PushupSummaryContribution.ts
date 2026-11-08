import type { SummaryContribution, WorkoutEventLike } from '@gym/exercise-core';

/**
 * Push-up summary contribution.
 *
 *  - `repsTowardTarget`: every rep feeds the user's reps-based daily
 *    target. The progress service treats the target as a MINIMUM:
 *    reps logged above it still count for XP, lifetime totals, and
 *    achievements. `repsTowardTarget` always returns the full event
 *    reps; only the stored `remainingReps` field is clamped at zero
 *    for display.
 *  - `marksDayActive`: `false`. A lone push-up event does not mark
 *    the day active for the streak; only hitting the daily target
 *    counts an active push-up day.
 */
export class PushupSummaryContribution implements SummaryContribution {
  public repsTowardTarget(event: WorkoutEventLike): number {
    return event.reps;
  }

  public marksDayActive(_event: WorkoutEventLike): boolean {
    return false;
  }
}
