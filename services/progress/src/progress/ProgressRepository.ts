import type { DailySummaryRecord, ProgressStateRecord } from './ProgressStateRecord.js';

/**
 * Persistence boundary for the progress service.
 *
 * Only the service holds a `ProgressRepository`. The AWS binding
 * lives in `DynamoProgressRepository`; `tests/progress/support/`
 * ships an in-memory fake that lets the service be exercised
 * without AWS.
 *
 * Writes are idempotent at the row level: {@link putState} replaces
 * the row atomically and {@link putDailySummary} is a put-only
 * upsert so a retry of the same event converges on the same final
 * state.
 */
export interface ProgressRepository {
  /** Fetch the user's state, or `null` if they have never been seen. */
  getState(userId: string): Promise<ProgressStateRecord | null>;

  /** Write (or overwrite) the user's state row. */
  putState(record: ProgressStateRecord): Promise<void>;

  /** Fetch a daily summary, or `null` if the day has no activity. */
  getDailySummary(userId: string, localDate: string): Promise<DailySummaryRecord | null>;

  /** Write (or overwrite) a daily summary row. */
  putDailySummary(record: DailySummaryRecord): Promise<void>;
}

/**
 * Idempotency gate for event consumers.
 *
 * `tryClaim` returns `true` when the given eventId has not been
 * seen before and the claim was persisted. A second call with the
 * same id returns `false`. Rows carry a DynamoDB TTL so claims age
 * out automatically.
 */
export interface ProcessedEventRepository {
  tryClaim(eventId: string, ttlSeconds: number): Promise<boolean>;
}
