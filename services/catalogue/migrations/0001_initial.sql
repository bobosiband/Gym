-- Initial catalogue schema.
--
-- Columns use camelCase to match the project naming rule. SQLite identifiers
-- are case-insensitive, so this is a style choice with no runtime effect.
--
-- `muscles` and `equipment` are stored as JSON-encoded string arrays, for
-- example `'["chest","triceps"]'`. Stage 2 queries use `LIKE '%"<value>"%'`
-- against those columns. A normalised join table is a candidate for a later
-- migration once query patterns are clearer.

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  muscles TEXT NOT NULL,
  equipment TEXT NOT NULL,
  instructions TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idxExercisesSlug ON exercises (slug);
