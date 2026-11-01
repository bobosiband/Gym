import { z } from 'zod';

/**
 * `streak.frozen.v1` event schema.
 *
 * Emitted by `services/progress` when a user's streak would have
 * broken but a streak freeze was consumed to cover the missed day.
 * `remainingFreezes` lets a consumer surface the balance to the user
 * without a separate query.
 */

export const STREAK_FROZEN_V1_DETAIL_TYPE = 'streak.frozen.v1';

export const streakFrozenV1Schema = z
  .object({
    eventId: z.string().uuid(),
    userId: z.string().min(1).max(128),
    streakDaysAfter: z.number().int().min(1),
    missedDays: z.number().int().min(1),
    remainingFreezes: z.number().int().min(0),
    occurredAt: z.string().datetime({ offset: false }),
  })
  .strict();

export type StreakFrozenV1 = z.infer<typeof streakFrozenV1Schema>;
