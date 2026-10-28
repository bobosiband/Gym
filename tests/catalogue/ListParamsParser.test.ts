import { describe, expect, it } from 'vitest';

import { ListParamsParser } from '../../services/catalogue/src/exercises/ListParamsParser.js';
import { ValidationError } from '../../services/catalogue/src/exercises/ValidationError.js';

describe('ListParamsParser.parse', () => {
  it('returns defaults when no params are present', () => {
    const url = new URL('https://example.com/exercises');
    const params = ListParamsParser.parse(url);
    expect(params).toEqual({
      muscle: null,
      equipment: null,
      limit: ListParamsParser.DEFAULT_LIMIT,
      offset: 0,
    });
  });

  it('parses valid muscle and equipment filters', () => {
    const url = new URL('https://example.com/exercises?muscle=chest&equipment=barbell');
    const params = ListParamsParser.parse(url);
    expect(params.muscle).toBe('chest');
    expect(params.equipment).toBe('barbell');
  });

  it('trims whitespace from filters', () => {
    const url = new URL('https://example.com/exercises?muscle=%20chest%20');
    const params = ListParamsParser.parse(url);
    expect(params.muscle).toBe('chest');
  });

  it('rejects empty filters', () => {
    const url = new URL('https://example.com/exercises?muscle=');
    expect(() => ListParamsParser.parse(url)).toThrow(ValidationError);
  });

  it('rejects filters that are only whitespace', () => {
    const url = new URL('https://example.com/exercises?muscle=%20%20');
    expect(() => ListParamsParser.parse(url)).toThrow(ValidationError);
  });

  it('parses a valid limit', () => {
    const url = new URL('https://example.com/exercises?limit=10');
    expect(ListParamsParser.parse(url).limit).toBe(10);
  });

  it('rejects zero or negative limit', () => {
    const zero = new URL('https://example.com/exercises?limit=0');
    const neg = new URL('https://example.com/exercises?limit=-5');
    expect(() => ListParamsParser.parse(zero)).toThrow(ValidationError);
    expect(() => ListParamsParser.parse(neg)).toThrow(ValidationError);
  });

  it('rejects non-integer limit', () => {
    const url = new URL('https://example.com/exercises?limit=5.5');
    expect(() => ListParamsParser.parse(url)).toThrow(ValidationError);
  });

  it('rejects limit over max', () => {
    const url = new URL(`https://example.com/exercises?limit=${ListParamsParser.MAX_LIMIT + 1}`);
    expect(() => ListParamsParser.parse(url)).toThrow(ValidationError);
  });

  it('parses offset including zero', () => {
    const url = new URL('https://example.com/exercises?offset=0');
    expect(ListParamsParser.parse(url).offset).toBe(0);
  });

  it('rejects negative offset', () => {
    const url = new URL('https://example.com/exercises?offset=-1');
    expect(() => ListParamsParser.parse(url)).toThrow(ValidationError);
  });
});
