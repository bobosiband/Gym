import { describe, expect, it } from 'vitest';

import { HandlerSchemas } from '../../services/logging/src/handlers/HandlerSchemas.js';

describe('HandlerSchemas.logWorkout', () => {
  const schema = HandlerSchemas.logWorkout();

  it('accepts a valid pushup payload', () => {
    const result = schema.safeParse({ exerciseId: 'push-up', kind: 'pushup', reps: 20 });
    expect(result.success).toBe(true);
  });

  it('accepts a valid set payload with optional fields', () => {
    const result = schema.safeParse({
      exerciseId: 'bench',
      kind: 'set',
      reps: 5,
      weightKg: 100,
      durationSeconds: 60,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown field (strict)', () => {
    const result = schema.safeParse({ exerciseId: 'x', kind: 'set', reps: 1, extra: true });
    expect(result.success).toBe(false);
  });

  it('rejects a negative rep count', () => {
    const result = schema.safeParse({ exerciseId: 'x', kind: 'set', reps: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer rep count', () => {
    const result = schema.safeParse({ exerciseId: 'x', kind: 'set', reps: 1.5 });
    expect(result.success).toBe(false);
  });

  it('accepts any kebab-case kind at the schema layer', () => {
    // Registry membership is enforced by the handler against the
    // injected ExerciseRegistry so new exercises do not require a
    // contract bump. See LogWorkoutHandler for the 400 path.
    const result = schema.safeParse({ exerciseId: 'x', kind: 'swim', reps: 1 });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed kind that violates the kebab-case shape', () => {
    const result = schema.safeParse({ exerciseId: 'x', kind: 'Push Up', reps: 1 });
    expect(result.success).toBe(false);
  });
});

describe('HandlerSchemas.listWorkoutsQuery', () => {
  const schema = HandlerSchemas.listWorkoutsQuery();

  it('accepts an empty query', () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('coerces limit from a string', () => {
    const result = schema.safeParse({ limit: '25' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(25);
  });

  it('rejects a limit above 100', () => {
    const result = schema.safeParse({ limit: '101' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-ISO from', () => {
    const result = schema.safeParse({ from: 'not-a-date' });
    expect(result.success).toBe(false);
  });
});
