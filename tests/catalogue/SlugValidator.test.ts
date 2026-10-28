import { describe, expect, it } from 'vitest';

import { SlugValidator } from '../../services/catalogue/src/exercises/SlugValidator.js';

describe('SlugValidator.isValid', () => {
  it('accepts kebab-case lowercase slugs', () => {
    expect(SlugValidator.isValid('bench-press')).toBe(true);
    expect(SlugValidator.isValid('squat')).toBe(true);
    expect(SlugValidator.isValid('overhead-shoulder-press')).toBe(true);
  });

  it('accepts digits', () => {
    expect(SlugValidator.isValid('exercise-1')).toBe(true);
    expect(SlugValidator.isValid('plank-30s')).toBe(true);
  });

  it('rejects uppercase, underscores, spaces, leading or trailing hyphens', () => {
    expect(SlugValidator.isValid('BenchPress')).toBe(false);
    expect(SlugValidator.isValid('bench_press')).toBe(false);
    expect(SlugValidator.isValid('bench press')).toBe(false);
    expect(SlugValidator.isValid('-bench-press')).toBe(false);
    expect(SlugValidator.isValid('bench-press-')).toBe(false);
    expect(SlugValidator.isValid('')).toBe(false);
  });
});
