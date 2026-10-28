import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  ValidationError,
  formatExerciseFromRow,
  isValidSlug,
  parseListParams,
} from '../../services/catalogue/src/exercises/parse.js';

describe('parseListParams', () => {
  it('returns defaults when no params are present', () => {
    const url = new URL('https://example.com/exercises');
    const params = parseListParams(url);
    expect(params).toEqual({
      muscle: null,
      equipment: null,
      limit: DEFAULT_LIMIT,
      offset: 0,
    });
  });

  it('parses valid muscle and equipment filters', () => {
    const url = new URL('https://example.com/exercises?muscle=chest&equipment=barbell');
    const params = parseListParams(url);
    expect(params.muscle).toBe('chest');
    expect(params.equipment).toBe('barbell');
  });

  it('trims whitespace from filters', () => {
    const url = new URL('https://example.com/exercises?muscle=%20chest%20');
    const params = parseListParams(url);
    expect(params.muscle).toBe('chest');
  });

  it('rejects empty filters', () => {
    const url = new URL('https://example.com/exercises?muscle=');
    expect(() => parseListParams(url)).toThrow(ValidationError);
  });

  it('rejects filters that are only whitespace', () => {
    const url = new URL('https://example.com/exercises?muscle=%20%20');
    expect(() => parseListParams(url)).toThrow(ValidationError);
  });

  it('parses a valid limit', () => {
    const url = new URL('https://example.com/exercises?limit=10');
    expect(parseListParams(url).limit).toBe(10);
  });

  it('rejects zero or negative limit', () => {
    const zero = new URL('https://example.com/exercises?limit=0');
    const neg = new URL('https://example.com/exercises?limit=-5');
    expect(() => parseListParams(zero)).toThrow(ValidationError);
    expect(() => parseListParams(neg)).toThrow(ValidationError);
  });

  it('rejects non-integer limit', () => {
    const url = new URL('https://example.com/exercises?limit=5.5');
    expect(() => parseListParams(url)).toThrow(ValidationError);
  });

  it('rejects limit over max', () => {
    const url = new URL(`https://example.com/exercises?limit=${MAX_LIMIT + 1}`);
    expect(() => parseListParams(url)).toThrow(ValidationError);
  });

  it('parses offset including zero', () => {
    const url = new URL('https://example.com/exercises?offset=0');
    expect(parseListParams(url).offset).toBe(0);
  });

  it('rejects negative offset', () => {
    const url = new URL('https://example.com/exercises?offset=-1');
    expect(() => parseListParams(url)).toThrow(ValidationError);
  });
});

describe('isValidSlug', () => {
  it('accepts kebab-case lowercase slugs', () => {
    expect(isValidSlug('bench-press')).toBe(true);
    expect(isValidSlug('squat')).toBe(true);
    expect(isValidSlug('overhead-shoulder-press')).toBe(true);
  });

  it('accepts digits', () => {
    expect(isValidSlug('exercise-1')).toBe(true);
    expect(isValidSlug('plank-30s')).toBe(true);
  });

  it('rejects uppercase, underscores, spaces, leading or trailing hyphens', () => {
    expect(isValidSlug('BenchPress')).toBe(false);
    expect(isValidSlug('bench_press')).toBe(false);
    expect(isValidSlug('bench press')).toBe(false);
    expect(isValidSlug('-bench-press')).toBe(false);
    expect(isValidSlug('bench-press-')).toBe(false);
    expect(isValidSlug('')).toBe(false);
  });
});

describe('formatExerciseFromRow', () => {
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
    const exercise = formatExerciseFromRow(baseRow);
    expect(exercise.id).toBe('ex-1');
    expect(exercise.slug).toBe('bench-press');
    expect(exercise.name).toBe('Bench press');
    expect(exercise.muscles).toEqual(['chest', 'triceps']);
    expect(exercise.equipment).toEqual(['barbell', 'bench']);
    expect(exercise.instructions).toBe('Lie on bench, press bar upward.');
    expect(exercise.createdAt).toBe('2025-01-15T10:00:00Z');
  });

  it('returns empty arrays for empty JSON arrays', () => {
    const exercise = formatExerciseFromRow({
      ...baseRow,
      muscles: '[]',
      equipment: '[]',
    });
    expect(exercise.muscles).toEqual([]);
    expect(exercise.equipment).toEqual([]);
  });

  it('throws when muscles is not a JSON array', () => {
    expect(() =>
      formatExerciseFromRow({
        ...baseRow,
        muscles: '{"not":"array"}',
      })
    ).toThrow();
  });

  it('throws when muscles contains non-string entries', () => {
    expect(() =>
      formatExerciseFromRow({
        ...baseRow,
        muscles: '["chest", 42]',
      })
    ).toThrow();
  });
});
