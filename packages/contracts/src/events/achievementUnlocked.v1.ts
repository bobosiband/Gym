import { z } from 'zod';

/**
 * `achievement.unlocked.v1` event schema.
 *
 * Emitted by `services/achievements` the first time a user meets a
 * badge rule (first workout, 100 total reps, 7-day streak, level 5).
 * Idempotent: re-processing an input event never produces a second
 * emission for the same badge.
 */

export const ACHIEVEMENT_UNLOCKED_V1_DETAIL_TYPE = 'achievement.unlocked.v1';

export const achievementUnlockedV1Schema = z
  .object({
    eventId: z.string().uuid(),
    userId: z.string().min(1).max(128),
    badgeId: z.string().min(1).max(64),
    name: z.string().min(1).max(128),
    description: z.string().min(1).max(500),
    unlockedAt: z.string().datetime({ offset: false }),
  })
  .strict();

export type AchievementUnlockedV1 = z.infer<typeof achievementUnlockedV1Schema>;
