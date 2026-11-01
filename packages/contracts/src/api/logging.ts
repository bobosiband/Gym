import { z } from 'zod';

import { workoutKindSchema } from '../events/workoutLogged.v1.js';

/**
 * Logging API contract (v1).
 *
 * HTTP shape for `services/logging`. Any change to the schemas in
 * this file is a breaking change and requires owner approval. Bump
 * the version in the filename (for example `logging.v2.ts`) for a
 * breaking schema change. See `docs/events.md` for the full
 * versioning rule.
 *
 * All request and response bodies are JSON. Error bodies follow
 * `loggingApiErrorSchema` and are returned with the matching HTTP
 * status. The schemas here are the runtime source of truth: the
 * handler Zod validation, the TypeScript types, and the generated
 * OpenAPI spec are all derived from these objects.
 */

/**
 * Standard error body for all 4xx and 5xx responses from the logging
 * API. `code` is a stable machine-readable identifier for the error;
 * `message` is a human-readable description.
 */
export const loggingApiErrorCodeSchema = z.enum([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'TOO_MANY_REQUESTS',
  'METHOD_NOT_ALLOWED',
  'PAYLOAD_TOO_LARGE',
  'SERVICE_UNAVAILABLE',
  'INTERNAL',
]);

/**
 * Zod schema for the error envelope. Exported as a schema so the
 * OpenAPI generator and tests can reuse it.
 */
export const loggingApiErrorSchema = z
  .object({
    code: loggingApiErrorCodeSchema,
    message: z.string().min(1).max(500),
  })
  .strict();

/**
 * Static type for the error envelope.
 */
export type LoggingApiError = z.infer<typeof loggingApiErrorSchema>;

/**
 * A single workout record returned by the logging API.
 *
 * `workoutId` is a UUID generated server-side. `loggedAt` is an
 * ISO 8601 UTC timestamp set by the service clock, not the client,
 * so entries sort stably across concurrent writes.
 */
export const workoutSchema = z
  .object({
    workoutId: z.string().uuid(),
    userId: z.string().min(1).max(128),
    loggedAt: z.string().datetime({ offset: false }),
    exerciseId: z.string().min(1).max(128),
    kind: workoutKindSchema,
    reps: z.number().int().min(1).max(10_000),
    weightKg: z.number().min(0).max(10_000).optional(),
    durationSeconds: z.number().int().min(1).max(86_400).optional(),
  })
  .strict();

/**
 * Static type for a workout record.
 */
export type Workout = z.infer<typeof workoutSchema>;

/**
 * Request body for `POST /workouts`. The caller does not supply
 * `userId` (that is read from the JWT), `workoutId` or `loggedAt`
 * (both server-generated). The pushup counter supplies `kind: 'pushup'`
 * and a positive `reps`; the manual logger supplies `kind: 'set'` and
 * optional `weightKg`.
 */
export const logWorkoutRequestSchema = z
  .object({
    exerciseId: z.string().min(1).max(128),
    kind: workoutKindSchema,
    reps: z.number().int().min(1).max(10_000),
    weightKg: z.number().min(0).max(10_000).optional(),
    durationSeconds: z.number().int().min(1).max(86_400).optional(),
  })
  .strict();

/**
 * Static type for the log-workout request body.
 */
export type LogWorkoutRequest = z.infer<typeof logWorkoutRequestSchema>;

/**
 * Response body for `POST /workouts` on success (HTTP 201).
 */
export const logWorkoutResponseSchema = z
  .object({
    workout: workoutSchema,
  })
  .strict();

/**
 * Static type for the log-workout response.
 */
export type LogWorkoutResponse = z.infer<typeof logWorkoutResponseSchema>;

/**
 * Response body for `GET /workouts/{workoutId}`.
 */
export const getWorkoutResponseSchema = z
  .object({
    workout: workoutSchema,
  })
  .strict();

/**
 * Static type for the get-workout response.
 */
export type GetWorkoutResponse = z.infer<typeof getWorkoutResponseSchema>;

/**
 * Query parameters for `GET /workouts`. All optional. `from` and `to`
 * bound `loggedAt`; `limit` defaults to 20 inside the handler and is
 * clamped to 100; `cursor` is an opaque server-produced string.
 */
export const listWorkoutsQuerySchema = z
  .object({
    from: z.string().datetime({ offset: false }).optional(),
    to: z.string().datetime({ offset: false }).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).max(2048).optional(),
  })
  .strict();

/**
 * Static type for the list-workouts query. Note that `limit` is a
 * `number` after `z.coerce`, not the original string from the URL.
 */
export type ListWorkoutsQuery = z.infer<typeof listWorkoutsQuerySchema>;

/**
 * Response body for `GET /workouts`. `cursor` is present only when
 * another page exists.
 */
export const listWorkoutsResponseSchema = z
  .object({
    workouts: z.array(workoutSchema),
    cursor: z.string().min(1).max(2048).optional(),
  })
  .strict();

/**
 * Static type for the list-workouts response.
 */
export type ListWorkoutsResponse = z.infer<typeof listWorkoutsResponseSchema>;
