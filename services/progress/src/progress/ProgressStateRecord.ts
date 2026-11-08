/**
 * Persisted shape of a daily target.
 *
 * `exerciseId` names the registered exercise whose reps feed this
 * target. Today only `pushup` is a reps-based target exercise; the
 * field is kept explicit so the planner and achievements services
 * can tell "100 push-ups a day" apart from "100 squats a day" once
 * squat lands.
 */
export interface DailyTargetRecord {
  readonly exerciseId: string;
  readonly repsPerDay: number;
  readonly durationDays: number;
  readonly startLocalDate: string;
  readonly totalReps: number;
  readonly remainingReps: number;
  readonly completedDays: number;
}

/**
 * Persisted shape of a single user's progress state. One row per
 * user in the main progress table, pk = USER#<userId>, sk = STATE.
 */
export interface ProgressStateRecord {
  readonly userId: string;
  readonly timeZone: string;
  readonly xp: number;
  readonly level: number;
  readonly streakDays: number;
  readonly freezeBalance: number;
  readonly lastActiveLocalDate: string | null;
  readonly dailyTarget: DailyTargetRecord | null;
}

/**
 * Persisted shape of a single-day roll-up. One row per
 * (user, local date) under pk = USER#<userId>, sk = DAY#<localDate>.
 * The row doubles as a lightweight audit trail of what happened on
 * each day of the user's history.
 *
 * Field semantics are driven by the exercise registry, not by a
 * hard-coded schema:
 *
 *  - `targetReps` is the running total of reps toward the user's
 *    daily target exercise (push-ups today). Reps above the target
 *    still accumulate here; the stored `remainingReps` on the
 *    target is clamped at zero separately for display.
 *  - `activityCount` is the running count of events whose exercise
 *    self-marks the day active (a resistance set is one event; a
 *    push-up event is not, because a push-up day is only active
 *    when the target is hit).
 */
export interface DailySummaryRecord {
  readonly userId: string;
  readonly localDate: string;
  readonly targetReps: number;
  readonly activityCount: number;
  readonly targetHit: boolean;
}
