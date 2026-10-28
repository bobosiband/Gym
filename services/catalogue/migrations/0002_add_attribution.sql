-- Add attribution columns required by every imported exercise.
--
-- `licence`      the short licence name (e.g. "CC-BY-SA 4", "CC0").
-- `author`       the licence_author string from the source, or a sensible
--                community fallback. Required.
-- `sourceUrl`    the canonical URL on the upstream site (e.g. wger entry).
--
-- Defaults keep ALTER TABLE safe for the pre-import empty state. Every
-- INSERT written by the import pipeline supplies real values.

ALTER TABLE exercises ADD COLUMN licence TEXT NOT NULL DEFAULT '';
ALTER TABLE exercises ADD COLUMN author TEXT NOT NULL DEFAULT '';
ALTER TABLE exercises ADD COLUMN sourceUrl TEXT NOT NULL DEFAULT '';
