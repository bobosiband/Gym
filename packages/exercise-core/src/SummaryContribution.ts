import type { WorkoutEventLike } from './WorkoutEventLike.js';

/**
 * Strategy that decides how an event for one exercise contributes to
 * a day's progress summary. The progress service folds every event
 * through this interface instead of branching on the exercise id.
 *
 * Two independent axes:
 *
 *  - `repsTowardTarget`: how many reps the event adds to a
 *    reps-based daily target that is pinned to this exercise. An
 *    exercise that is not a candidate for a reps-based target
 *    (for example a resistance set) returns `0`.
 *  - `marksDayActive`: whether logging this event is, on its own,
 *    enough to count the day as active for streak purposes
 *    (a resistance set is yes; a push-up event is no, because only
 *    hitting the target counts an active day for push-ups).
 *
 * Reps above the daily target still earn XP, still accumulate for
 * lifetime totals downstream, and still trigger achievements.
 * `repsTowardTarget` always returns the full event reps; the
 * progress service clamps `remainingReps` at zero for display only.
 */
export interface SummaryContribution {
  repsTowardTarget(event: WorkoutEventLike): number;
  marksDayActive(event: WorkoutEventLike): boolean;
}
