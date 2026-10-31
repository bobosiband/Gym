import type { Workout } from './Workout.js';

/**
 * Query parameters for a per-user workout listing.
 *
 * `from` and `to` are inclusive bounds on `loggedAt` as ISO 8601
 * UTC strings. `limit` is validated in the handler to be between
 * 1 and 100; the repository treats it as an unchecked integer.
 * `cursor` is an opaque string produced by a prior call to this
 * repository and must be returned unchanged.
 */
export interface ListWorkoutsOptions {
  readonly from?: string;
  readonly to?: string;
  readonly limit: number;
  readonly cursor?: string;
}

/**
 * Page of workout results returned by `list`.
 */
export interface WorkoutPage {
  readonly workouts: readonly Workout[];
  readonly cursor?: string;
}

/**
 * Persistence boundary for workout records. The service holds a
 * `WorkoutRepository`; the AWS implementation lives in
 * `DynamoWorkoutRepository` and the in-memory fake in
 * `tests/logging/support/InMemoryWorkoutRepository.ts`.
 */
export interface WorkoutRepository {
  /**
   * Insert a new workout. Rejects if a workout with the same
   * `(userId, loggedAt, workoutId)` tuple already exists; the
   * service relies on this to make retries idempotent.
   */
  put(workout: Workout): Promise<void>;

  /**
   * Point lookup by workoutId. Returns `null` when no row exists.
   * The caller is responsible for comparing `item.userId` against
   * the authenticated subject and returning 404 to foreign callers.
   */
  getById(workoutId: string): Promise<Workout | null>;

  /**
   * List a user's workouts, most recent first.
   */
  list(userId: string, options: ListWorkoutsOptions): Promise<WorkoutPage>;
}
