import type { LoggingApi } from '@gym/contracts';
import { WorkoutLoggedV1Event } from '@gym/contracts';

import type { EventPublisher } from '../events/EventPublisher.js';
import type { IdempotencyRecord } from '../idempotency/IdempotencyRecord.js';
import type { IdempotencyRepository } from '../idempotency/IdempotencyRepository.js';
import type { Clock } from '../util/Clock.js';
import type { IdGenerator } from '../util/IdGenerator.js';
import type { Workout } from '../workouts/Workout.js';
import type {
  ListWorkoutsOptions,
  WorkoutPage,
  WorkoutRepository,
} from '../workouts/WorkoutRepository.js';
import { LoggingServiceError } from './LoggingServiceErrors.js';

/**
 * Dependencies injected into `LoggingService`. Each boundary is an
 * interface so tests can swap in an in-memory fake; see
 * `tests/logging/support/buildLoggingService.ts`.
 */
export interface LoggingServiceDeps {
  readonly workouts: WorkoutRepository;
  readonly idempotency: IdempotencyRepository;
  readonly events: EventPublisher;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

/**
 * Input to `logWorkout`. `userId` comes from the verified JWT
 * subject and is set by the handler, not the client. `body` is
 * the Zod-validated request body. `idempotencyKey` is an
 * optional caller-supplied string (header `Idempotency-Key`) that
 * guarantees exactly-once semantics on retry.
 */
export interface LogWorkoutInput {
  readonly userId: string;
  readonly body: LoggingApi.LogWorkoutRequest;
  readonly idempotencyKey?: string;
}

/**
 * Core service for the logging bounded context.
 *
 * Only this class knows the sequence that keeps the system
 * consistent on retry: reserve the workoutId and eventId inside
 * an idempotency row before writing the main workout row and
 * before publishing. The handlers are thin shells on top; the
 * repositories, event publisher, clock and id generator are the
 * open/closed seams.
 */
export class LoggingService {
  private static readonly IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

  public constructor(private readonly deps: LoggingServiceDeps) {}

  /**
   * Record a workout, publish `workout.logged.v1`, and return the
   * persisted record.
   *
   * Flow when `idempotencyKey` is supplied:
   *   1. Insert an idempotency row with status `in_progress` using
   *      a conditional `attribute_not_exists`. The row carries the
   *      pre-generated `workoutId`, `eventId`, and the full workout
   *      shape so a retry can return the exact same response.
   *   2. If the row already existed, branch on status:
   *      `completed` returns the cached response; `in_progress`
   *      re-attempts the event publish and marks completed on
   *      success. On persistent publish failure, surfaces
   *      `EVENT_PUBLISH_FAILED`.
   *   3. Otherwise persist the workout row (conditional write so
   *      a client-side retry without idempotency never duplicates).
   *   4. Publish the event.
   *   5. Mark the idempotency row completed.
   *
   * Flow without an idempotency key: persist, publish, return.
   * A publish failure surfaces as `EVENT_PUBLISH_FAILED` and no
   * compensating delete runs because consumers tolerate missing
   * events (see `docs/events.md` on eventId-based dedupe).
   */
  public async logWorkout(input: LogWorkoutInput): Promise<LoggingApi.LogWorkoutResponse> {
    const workoutId = this.deps.ids.newId();
    const eventId = this.deps.ids.newId();
    const loggedAt = this.deps.clock.nowIso();
    const workout: Workout = {
      workoutId,
      userId: input.userId,
      loggedAt,
      exerciseId: input.body.exerciseId,
      kind: input.body.kind,
      reps: input.body.reps,
      ...(input.body.weightKg === undefined ? {} : { weightKg: input.body.weightKg }),
      ...(input.body.durationSeconds === undefined
        ? {}
        : { durationSeconds: input.body.durationSeconds }),
    };

    if (input.idempotencyKey === undefined) {
      await this.deps.workouts.put(workout);
      try {
        await this.publishLoggedEvent(workout, eventId);
      } catch {
        throw new LoggingServiceError('EVENT_PUBLISH_FAILED', 'event publish failed; retry later');
      }
      return { workout };
    }

    const reserved: IdempotencyRecord = {
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      workoutId,
      eventId,
      status: 'in_progress',
      workout,
      expiresAt: this.deps.clock.nowSeconds() + LoggingService.IDEMPOTENCY_TTL_SECONDS,
    };
    const outcome = await this.deps.idempotency.beginOrGet(reserved);
    if (outcome.kind === 'existing') {
      return this.resumeExistingIdempotencyRow(outcome.record);
    }
    await this.deps.workouts.put(outcome.record.workout);
    try {
      await this.publishLoggedEvent(outcome.record.workout, outcome.record.eventId);
    } catch {
      throw new LoggingServiceError('EVENT_PUBLISH_FAILED', 'event publish failed; retry later');
    }
    await this.deps.idempotency.markCompleted({ ...outcome.record, status: 'completed' });
    return { workout: outcome.record.workout };
  }

  /**
   * Fetch a workout by id, enforcing ownership.
   */
  public async getWorkout(userId: string, workoutId: string): Promise<Workout> {
    const row = await this.deps.workouts.getById(workoutId);
    if (row === null || row.userId !== userId) {
      throw new LoggingServiceError('NOT_FOUND', 'workout not found');
    }
    return row;
  }

  /**
   * List a user's workouts, newest first.
   */
  public async listWorkouts(userId: string, options: ListWorkoutsOptions): Promise<WorkoutPage> {
    return this.deps.workouts.list(userId, options);
  }

  private async resumeExistingIdempotencyRow(
    row: IdempotencyRecord
  ): Promise<LoggingApi.LogWorkoutResponse> {
    if (row.status === 'completed') {
      return { workout: row.workout };
    }
    try {
      await this.publishLoggedEvent(row.workout, row.eventId);
      await this.deps.idempotency.markCompleted({ ...row, status: 'completed' });
      return { workout: row.workout };
    } catch {
      throw new LoggingServiceError('EVENT_PUBLISH_FAILED', 'event publish failed; retry later');
    }
  }

  private async publishLoggedEvent(workout: Workout, eventId: string): Promise<void> {
    const payload = {
      eventId,
      userId: workout.userId,
      workoutId: workout.workoutId,
      loggedAt: workout.loggedAt,
      exerciseId: workout.exerciseId,
      kind: workout.kind,
      reps: workout.reps,
      ...(workout.weightKg === undefined ? {} : { weightKg: workout.weightKg }),
      ...(workout.durationSeconds === undefined
        ? {}
        : { durationSeconds: workout.durationSeconds }),
    };
    await this.deps.events.publish(WorkoutLoggedV1Event.WORKOUT_LOGGED_V1_DETAIL_TYPE, payload);
  }
}
