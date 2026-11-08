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
 * Format of the `kind` field. The value is a registered exercise
 * strategy id (for example `set`, `pushup`, or a future `squat`),
 * resolved at runtime against the service's {@link ExerciseRegistry}
 * in `@gym/exercise-core`. Unknown ids are rejected at the handler
 * boundary with a 400, not by Zod, so adding a new exercise does not
 * require a contract bump.
 *
 * The regex locks the shape to lower-case kebab-case so downstream
 * services (event bus detail types, log tags, URL path segments)
 * never have to escape the value.
 */
export const workoutKindSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9-]*$/);

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
