-- Small fixture seed for integration tests. Three exercises covering
-- different muscles, equipment, licences, and authors so filters,
-- paging, detail, and attribution can all be exercised.

INSERT OR REPLACE INTO exercises (id, slug, name, muscles, equipment, instructions, createdAt, licence, author, sourceUrl)
VALUES
  ('wger-192', 'bench-press-192', 'Bench Press',
   '["chest","triceps"]', '["barbell","bench"]',
   'Lie on bench, press bar upward.',
   '2026-10-29T12:00:00Z', 'CC-BY-SA 4', 'Roger Reyes',
   'https://wger.de/en/exercise/192/view/'),
  ('wger-184', 'deadlift-184', 'Deadlift',
   '["back","hamstrings"]', '["barbell"]',
   'Lift the bar from the floor to the hip.',
   '2026-10-29T12:00:00Z', 'CC-BY-SA 4', 'wger community',
   'https://wger.de/en/exercise/184/view/'),
  ('wger-100', 'squat-100', 'Squat',
   '["quadriceps","glutes"]', '["barbell"]',
   'Bend knees, lower hips, stand back up.',
   '2026-10-29T12:00:00Z', 'CC0', 'wger community',
   'https://wger.de/en/exercise/100/view/');
