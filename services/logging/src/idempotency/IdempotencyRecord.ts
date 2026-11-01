import type { Workout } from '../workouts/Workout.js';

/**
 * One of two states an idempotency row can be in.
 *
 * `in_progress`: the service has reserved the workoutId and
 * eventId for this key but has not yet confirmed the event
 * publish. A retry with the same key will attempt to re-publish
 * using the stored eventId (consumers dedupe on it) and, if the
 * publish now succeeds, flip the row to `completed`.
 *
 * `completed`: the workout was persisted and the event published.
 * Any further retry returns the cached response verbatim.
 */
export type IdempotencyStatus = 'in_progress' | 'completed';

/**
 * Persistent idempotency row.
 *
 * The row is keyed by `(userId, idempotencyKey)` so two users
 * cannot collide on the same key. `expiresAt` is a Unix seconds
 * value used as the DynamoDB TTL attribute; the record is
 * guaranteed to disappear within 48 hours of creation.
 */
export interface IdempotencyRecord {
  readonly userId: string;
  readonly idempotencyKey: string;
  readonly workoutId: string;
  readonly eventId: string;
  readonly status: IdempotencyStatus;
  readonly workout: Workout;
  readonly expiresAt: number;
}
