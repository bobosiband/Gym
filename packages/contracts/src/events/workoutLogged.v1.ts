import { z } from 'zod';

/**
 * `workout.logged.v1` event schema.
 *
 * Emitted by `services/logging` on every successful write to the
 * workouts table, after the row has been persisted and before the
 * HTTP response is returned to the caller. Any change to this type
 * is a breaking change and requires owner approval. See
 * `docs/events.md` for the versioning rule.
 *
 * The event is a fact, not a command. Consumers must tolerate
 * duplicate deliveries and use `eventId` as the idempotency key;
 * the logging service re-publishes with the same `eventId` on
 * retry of an in-flight write so dedupe works end to end.
 */

/**
 * Canonical event name on the bus. Including the version suffix in
 * the detail type makes it easy for consumers to match a specific
 * schema version without string manipulation.
 */
export const WORKOUT_LOGGED_V1_DETAIL_TYPE = 'workout.logged.v1';

/**
 * Allowed values for the `kind` field. A `set` is a resistance-training
 * entry (reps against a load) and a `pushup` is the body-weight count
 * produced by `apps/pushup-counter` when a session ends.
 */
export const workoutKindSchema = z.enum(['set', 'pushup']);

/**
 * Detail payload for `workout.logged.v1`.
 *
 * `userId` is the auth service's canonical identifier for the user
 * (the same `sub` claim that appears in access tokens). `loggedAt`
 * is an ISO 8601 UTC timestamp produced by the service clock, not
 * the client, so consumers can rely on monotonic ordering per user.
 */
export const workoutLoggedV1Schema = z
  .object({
    eventId: z.string().uuid(),
    userId: z.string().min(1).max(128),
    workoutId: z.string().uuid(),
    loggedAt: z.string().datetime({ offset: false }),
    exerciseId: z.string().min(1).max(128),
    kind: workoutKindSchema,
    reps: z.number().int().min(1).max(10_000),
    weightKg: z.number().min(0).max(10_000).optional(),
    durationSeconds: z.number().int().min(1).max(86_400).optional(),
  })
  .strict();

/**
 * Static type inferred from the Zod schema. Importers should use
 * this type rather than redeclaring the shape so a schema change
 * surfaces as a type error at every call site.
 */
export type WorkoutLoggedV1 = z.infer<typeof workoutLoggedV1Schema>;
