import { z } from 'zod';

/**
 * Achievements API contract (v1).
 *
 * HTTP shape for `services/achievements`. Any change to the schemas
 * in this file is a breaking change and requires owner approval.
 * Bump the version in the filename (for example `achievements.v2.ts`)
 * for a breaking schema change. See `docs/events.md` for the full
 * versioning rule.
 */

export const achievementsApiErrorCodeSchema = z.enum([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'INTERNAL',
]);

export const achievementsApiErrorSchema = z
  .object({
    code: achievementsApiErrorCodeSchema,
    message: z.string().min(1).max(500),
  })
  .strict();

export type AchievementsApiError = z.infer<typeof achievementsApiErrorSchema>;

/**
 * A single unlocked badge in the user's roll-up response.
 *
 * `badgeId` is stable (for example `first-workout`); `name` and
 * `description` are frozen strings copied from the badge rule at
 * unlock time so the UI does not need to reach back into a lookup
 * table.
 */
export const achievementSchema = z
  .object({
    badgeId: z.string().min(1).max(64),
    name: z.string().min(1).max(128),
    description: z.string().min(1).max(500),
    unlockedAt: z.string().datetime({ offset: false }),
  })
  .strict();

export type Achievement = z.infer<typeof achievementSchema>;

/**
 * Response body for `GET /achievements`. Newest unlock first.
 */
export const listAchievementsResponseSchema = z
  .object({
    achievements: z.array(achievementSchema),
  })
  .strict();

export type ListAchievementsResponse = z.infer<typeof listAchievementsResponseSchema>;
