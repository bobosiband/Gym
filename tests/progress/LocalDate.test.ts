import { describe, expect, it } from 'vitest';

import { LocalDate } from '../../services/progress/src/util/LocalDate.js';

describe('LocalDate.fromIsoUtc', () => {
  it('converts a UTC instant to the local calendar date in Australia/Sydney', () => {
    expect(LocalDate.fromIsoUtc('2026-11-01T13:30:00', 'Australia/Sydney')).toBe('2026-11-02');
  });

  it('converts an instant to a calendar date in America/Los_Angeles', () => {
    expect(LocalDate.fromIsoUtc('2026-11-02T05:00:00', 'America/Los_Angeles')).toBe('2026-11-01');
  });

  it('handles DST transitions in New York', () => {
    expect(LocalDate.fromIsoUtc('2026-11-01T06:00:00', 'America/New_York')).toBe('2026-11-01');
    expect(LocalDate.fromIsoUtc('2026-11-01T07:00:00', 'America/New_York')).toBe('2026-11-01');
  });
});

describe('LocalDate.dayDelta', () => {
  it('returns zero for the same date', () => {
    expect(LocalDate.dayDelta('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('returns one across a day boundary', () => {
    expect(LocalDate.dayDelta('2026-01-01', '2026-01-02')).toBe(1);
  });

  it('spans a leap year correctly', () => {
    expect(LocalDate.dayDelta('2028-02-28', '2028-03-01')).toBe(2);
  });

  it('returns a negative value when the second date is earlier', () => {
    expect(LocalDate.dayDelta('2026-02-02', '2026-02-01')).toBe(-1);
  });
});

describe('LocalDate.addDays', () => {
  it('adds days without being affected by DST', () => {
    expect(LocalDate.addDays('2026-03-28', 2)).toBe('2026-03-30');
  });
});

describe('LocalDate.isValidZone', () => {
  it('accepts canonical IANA zones', () => {
    expect(LocalDate.isValidZone('Australia/Sydney')).toBe(true);
    expect(LocalDate.isValidZone('UTC')).toBe(true);
  });

  it('rejects nonsense', () => {
    expect(LocalDate.isValidZone('Not/A_Zone')).toBe(false);
  });
});
