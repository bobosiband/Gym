import type { AchievementRecord, UserSnapshot } from './UserSnapshot.js';

/**
 * Persistence port for the achievements bounded context. The service
 * depends only on this interface; the D1 driver and in-memory fake
 * both implement it.
 */
export interface AchievementRepository {
  /** Return the snapshot for a user, or `null` if none has been stored. */
  getSnapshot(userId: string): Promise<UserSnapshot | null>;

  /** Insert or replace the snapshot. */
  putSnapshot(snapshot: UserSnapshot): Promise<void>;

  /**
   * Insert a badge the first time it unlocks. Returns `true` if the
   * insert happened and `false` if the badge was already present
   * (idempotent on the natural key `(userId, badgeId)`).
   */
  insertAchievementIfAbsent(record: AchievementRecord): Promise<boolean>;

  /** Return the user's unlocked badges, newest first. */
  listAchievements(userId: string): Promise<readonly AchievementRecord[]>;
}

/**
 * Companion repository that keeps the processed-event id set so the
 * event webhook is idempotent on EventBridge retries.
 */
export interface ProcessedEventRepository {
  /**
   * Try to claim the event id. Returns `true` if the id was not
   * previously seen (the event should be processed) and `false` if
   * it was (the event is a replay and must be ignored).
   */
  tryClaim(eventId: string): Promise<boolean>;
}
