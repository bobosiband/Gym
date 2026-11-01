import { z } from 'zod';

/**
 * `streak.broken.v1` event schema.
 *
 * Emitted by `services/progress` when a user's activity streak is
 * reset to one because a day passed without a counted activity and
 * no streak freeze was available. `previousStreakDays` is the streak
 * length immediately before the reset; it is at least `1` because a
 * never-started streak does not emit this event.
 */

export const STREAK_BROKEN_V1_DETAIL_TYPE = 'streak.broken.v1';

export const streakBrokenV1Schema = z
  .object({
    eventId: z.string().uuid(),
    userId: z.string().min(1).max(128),
    previousStreakDays: z.number().int().min(1),
    missedDays: z.number().int().min(1),
    occurredAt: z.string().datetime({ offset: false }),
  })
  .strict();

export type StreakBrokenV1 = z.infer<typeof streakBrokenV1Schema>;
