import { z } from 'zod';

/**
 * Progress API contract (v1).
 *
 * HTTP shape for `services/progress`. Any change to the schemas in
 * this file is a breaking change and requires owner approval. Bump
 * the version in the filename (for example `progress.v2.ts`) for a
 * breaking schema change. See `docs/events.md` for the full
 * versioning rule.
 */

/**
 * Standard error body for all 4xx and 5xx responses from the
 * progress API.
 */
export const progressApiErrorCodeSchema = z.enum([
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

export const progressApiErrorSchema = z
  .object({
    code: progressApiErrorCodeSchema,
    message: z.string().min(1).max(500),
  })
  .strict();

export type ProgressApiError = z.infer<typeof progressApiErrorSchema>;

/**
 * IANA time zone string. The service accepts any value that
 * `Intl.DateTimeFormat` can resolve; validation happens inside the
 * handler (not in Zod) because the set of valid zones is not
 * knowable at schema compile time.
 */
export const timeZoneSchema = z.string().min(1).max(64);

/**
 * Daily target block in the progress response.
 *
 * `exerciseId` names the registered exercise whose reps feed this
 * target (today, always `pushup`; the field is explicit so a future
 * squat target does not look identical on the wire).
 *
 * `remainingReps` decreases as matching events arrive. The target is
 * a MINIMUM: reps logged above it still count for XP, lifetime
 * totals, and achievements. `completedDays` counts the number of
 * distinct local dates on which the target was hit; once it equals
 * `durationDays`, the target is complete and `remainingReps` is
 * zero.
 */
export const dailyTargetSchema = z
  .object({
    exerciseId: z.string().min(1).max(64),
    repsPerDay: z.number().int().min(1).max(10_000),
    durationDays: z.number().int().min(1).max(365),
    startLocalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    totalReps: z.number().int().min(1),
    remainingReps: z.number().int().min(0),
    completedDays: z.number().int().min(0),
  })
  .strict();

export type DailyTarget = z.infer<typeof dailyTargetSchema>;

/**
 * Progress snapshot returned by `GET /progress`.
 *
 * `effectiveStreakDays` collapses the stored streak against the
 * current local date so a user who has not logged today can see a
 * streak-at-risk value without the service having to run a nightly
 * sweep.
 */
export const progressStateSchema = z
  .object({
    userId: z.string().min(1).max(128),
    timeZone: timeZoneSchema,
    xp: z.number().int().min(0),
    level: z.number().int().min(1),
    xpToNextLevel: z.number().int().min(0),
    streakDays: z.number().int().min(0),
    effectiveStreakDays: z.number().int().min(0),
    freezeBalance: z.number().int().min(0),
    lastActiveLocalDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    dailyTarget: dailyTargetSchema.nullable(),
  })
  .strict();

export type ProgressState = z.infer<typeof progressStateSchema>;

/**
 * Response body for `GET /progress`.
 */
export const getProgressResponseSchema = z.object({ progress: progressStateSchema }).strict();
export type GetProgressResponse = z.infer<typeof getProgressResponseSchema>;

/**
 * Request body for `PUT /progress/timezone`.
 */
export const setTimeZoneRequestSchema = z.object({ timeZone: timeZoneSchema }).strict();
export type SetTimeZoneRequest = z.infer<typeof setTimeZoneRequestSchema>;

/**
 * Response body for `PUT /progress/timezone`.
 */
export const setTimeZoneResponseSchema = z.object({ progress: progressStateSchema }).strict();
export type SetTimeZoneResponse = z.infer<typeof setTimeZoneResponseSchema>;

/**
 * Request body for `POST /progress/daily-target`.
 */
export const setDailyTargetRequestSchema = z
  .object({
    repsPerDay: z.number().int().min(1).max(10_000),
    durationDays: z.number().int().min(1).max(365),
  })
  .strict();
export type SetDailyTargetRequest = z.infer<typeof setDailyTargetRequestSchema>;

/**
 * Response body for `POST /progress/daily-target`.
 */
export const setDailyTargetResponseSchema = z.object({ progress: progressStateSchema }).strict();
export type SetDailyTargetResponse = z.infer<typeof setDailyTargetResponseSchema>;
