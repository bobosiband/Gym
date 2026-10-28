import { describe, expect, it } from 'vitest';

import { ExerciseFormatter } from '../../services/catalogue/src/exercises/ExerciseFormatter.js';

describe('ExerciseFormatter.fromRow', () => {
  const baseRow = {
    id: 'ex-1',
    slug: 'bench-press',
    name: 'Bench press',
    muscles: '["chest","triceps"]',
    equipment: '["barbell","bench"]',
    instructions: 'Lie on bench, press bar upward.',
    createdAt: '2025-01-15T10:00:00Z',
  };

  it('parses JSON arrays into string arrays', () => {
    const exercise = ExerciseFormatter.fromRow(baseRow);
    expect(exercise.id).toBe('ex-1');
    expect(exercise.slug).toBe('bench-press');
    expect(exercise.name).toBe('Bench press');
    expect(exercise.muscles).toEqual(['chest', 'triceps']);
    expect(exercise.equipment).toEqual(['barbell', 'bench']);
    expect(exercise.instructions).toBe('Lie on bench, press bar upward.');
    expect(exercise.createdAt).toBe('2025-01-15T10:00:00Z');
  });

  it('returns empty arrays for empty JSON arrays', () => {
    const exercise = ExerciseFormatter.fromRow({
      ...baseRow,
      muscles: '[]',
      equipment: '[]',
    });
    expect(exercise.muscles).toEqual([]);
    expect(exercise.equipment).toEqual([]);
  });

  it('throws when muscles is not a JSON array', () => {
    expect(() =>
      ExerciseFormatter.fromRow({
        ...baseRow,
        muscles: '{"not":"array"}',
      })
    ).toThrow();
  });

  it('throws when muscles contains non-string entries', () => {
    expect(() =>
      ExerciseFormatter.fromRow({
        ...baseRow,
        muscles: '["chest", 42]',
      })
    ).toThrow();
  });
});
