/**
 * Persisted shape of a daily target.
 */
export interface DailyTargetRecord {
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
 */
export interface DailySummaryRecord {
  readonly userId: string;
  readonly localDate: string;
  readonly pushupReps: number;
  readonly setCount: number;
  readonly targetHit: boolean;
}
