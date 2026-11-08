/**
 * Shape of the per-event data every exercise strategy sees.
 *
 * This is deliberately narrower than the full `workout.logged.v1`
 * event so the exercise-core package has no dependency on the event
 * version. Callers pluck only these fields off the event before
 * handing them to an {@link XpRule} or {@link SummaryContribution}.
 */
export interface WorkoutEventLike {
  readonly reps: number;
  readonly weightKg?: number;
  readonly durationSeconds?: number;
}
