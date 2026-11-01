import { z } from 'zod';

/**
 * `progress.level_up.v1` event schema.
 *
 * Emitted by `services/progress` whenever a user crosses a level
 * threshold. Consumers (eventually `services/achievements`) can award
 * badges keyed off this event; see `docs/events.md` for the full
 * registry.
 */

/** Canonical event name on the bus. */
export const PROGRESS_LEVEL_UP_V1_DETAIL_TYPE = 'progress.level_up.v1';

/**
 * Detail payload for `progress.level_up.v1`. `eventId` is a UUID
 * the service generates per emission so consumers can dedupe.
 * `previousLevel` lets a consumer compute how many levels were
 * crossed in a single batch (for example, if a late-arriving event
 * credits several days of XP at once).
 */
export const progressLevelUpV1Schema = z
  .object({
    eventId: z.string().uuid(),
    userId: z.string().min(1).max(128),
    previousLevel: z.number().int().min(0),
    newLevel: z.number().int().min(1),
    xpTotal: z.number().int().min(0),
    occurredAt: z.string().datetime({ offset: false }),
  })
  .strict();

export type ProgressLevelUpV1 = z.infer<typeof progressLevelUpV1Schema>;
