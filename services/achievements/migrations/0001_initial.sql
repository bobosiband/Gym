-- Initial achievements schema.
--
-- Columns use camelCase to match the project naming rule. SQLite
-- identifiers are case-insensitive so this is a style choice with no
-- runtime effect.

-- Rolling per-user snapshot. Badge rules read these fields to decide
-- whether to unlock. Updated by the event consumer on each incoming
-- workout.logged.v1 and progress.level_up.v1.
CREATE TABLE IF NOT EXISTS user_snapshots (
  userId TEXT PRIMARY KEY,
  totalWorkouts INTEGER NOT NULL DEFAULT 0,
  totalReps INTEGER NOT NULL DEFAULT 0,
  highestLevel INTEGER NOT NULL DEFAULT 1,
  activeDaysJson TEXT NOT NULL DEFAULT '[]',
  updatedAt TEXT NOT NULL
);

-- Unlocked badges per user. `name` and `description` are frozen at
-- unlock time so the UI does not need a lookup table and a renamed
-- rule never retroactively changes a user's history.
CREATE TABLE IF NOT EXISTS user_achievements (
  userId TEXT NOT NULL,
  badgeId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  unlockedAt TEXT NOT NULL,
  PRIMARY KEY (userId, badgeId)
);

-- Processed event ids for idempotent event consumption. TTL is
-- enforced by the application sweep (events keep a 30-day window).
CREATE TABLE IF NOT EXISTS processed_events (
  eventId TEXT PRIMARY KEY,
  processedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idxAchievementsByUserTime
  ON user_achievements (userId, unlockedAt DESC);
