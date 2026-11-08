/**
 * Rolling per-user state read by every {@link BadgeRule}. Updated
 * by the event consumer on each incoming workout.logged.v1 and
 * progress.level_up.v1.
 *
 * `activeDays` is an array of local ISO dates (`YYYY-MM-DD`) kept in
 * ascending order with no duplicates. Only the last 60 days are
 * retained so the row stays bounded.
 */
export interface UserSnapshot {
  readonly userId: string;
  readonly totalWorkouts: number;
  readonly totalReps: number;
  readonly highestLevel: number;
  readonly activeDays: readonly string[];
  readonly updatedAt: string;
}

/**
 * A badge record as persisted. The frozen `name` and `description`
 * fields let the UI render without a lookup table.
 */
export interface AchievementRecord {
  readonly userId: string;
  readonly badgeId: string;
  readonly name: string;
  readonly description: string;
  readonly unlockedAt: string;
}
