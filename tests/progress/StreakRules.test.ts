import { describe, expect, it } from 'vitest';

import { StreakRules } from '../../services/progress/src/progress/StreakRules.js';

describe('StreakRules.onActiveDay', () => {
  it('starts a streak at 1 when there was no last active date', () => {
    const outcome = StreakRules.onActiveDay({
      todayLocalDate: '2026-11-02',
      lastActiveLocalDate: null,
      streakDays: 0,
      freezeBalance: 0,
    });
    expect(outcome).toEqual({
      streakDays: 1,
      freezeBalance: 0,
      kind: 'started',
      previousStreakDays: 0,
      missedDays: 0,
    });
  });

  it('holds the streak when the day has already been counted', () => {
    const outcome = StreakRules.onActiveDay({
      todayLocalDate: '2026-11-02',
      lastActiveLocalDate: '2026-11-02',
      streakDays: 3,
      freezeBalance: 0,
    });
    expect(outcome.kind).toBe('held');
    expect(outcome.streakDays).toBe(3);
  });

  it('advances by one on the next day', () => {
    const outcome = StreakRules.onActiveDay({
      todayLocalDate: '2026-11-02',
      lastActiveLocalDate: '2026-11-01',
      streakDays: 5,
      freezeBalance: 0,
    });
    expect(outcome.kind).toBe('advanced');
    expect(outcome.streakDays).toBe(6);
  });

  it('uses a freeze to cover a single missed day', () => {
    const outcome = StreakRules.onActiveDay({
      todayLocalDate: '2026-11-03',
      lastActiveLocalDate: '2026-11-01',
      streakDays: 7,
      freezeBalance: 2,
    });
    expect(outcome.kind).toBe('frozen');
    expect(outcome.streakDays).toBe(9);
    expect(outcome.freezeBalance).toBe(1);
    expect(outcome.missedDays).toBe(1);
  });

  it('resets the streak when freezes cannot cover the gap', () => {
    const outcome = StreakRules.onActiveDay({
      todayLocalDate: '2026-11-05',
      lastActiveLocalDate: '2026-11-01',
      streakDays: 10,
      freezeBalance: 1,
    });
    expect(outcome.kind).toBe('broken');
    expect(outcome.streakDays).toBe(1);
    expect(outcome.previousStreakDays).toBe(10);
    expect(outcome.missedDays).toBe(3);
    expect(outcome.freezeBalance).toBe(1);
  });

  it('handles DST shifts cleanly because dates are in UTC', () => {
    const outcome = StreakRules.onActiveDay({
      todayLocalDate: '2026-04-05',
      lastActiveLocalDate: '2026-04-04',
      streakDays: 2,
      freezeBalance: 0,
    });
    expect(outcome.kind).toBe('advanced');
  });
});

describe('StreakRules.effectiveStreak', () => {
  it('is zero before any activity', () => {
    expect(
      StreakRules.effectiveStreak({
        todayLocalDate: '2026-11-02',
        lastActiveLocalDate: null,
        streakDays: 0,
        freezeBalance: 0,
      })
    ).toBe(0);
  });

  it('returns the stored streak when today is on or next to the last active date', () => {
    expect(
      StreakRules.effectiveStreak({
        todayLocalDate: '2026-11-02',
        lastActiveLocalDate: '2026-11-01',
        streakDays: 4,
        freezeBalance: 0,
      })
    ).toBe(4);
  });

  it('reports zero when the gap outruns the freeze budget', () => {
    expect(
      StreakRules.effectiveStreak({
        todayLocalDate: '2026-11-05',
        lastActiveLocalDate: '2026-11-01',
        streakDays: 10,
        freezeBalance: 1,
      })
    ).toBe(0);
  });

  it('preserves the streak when the user still has enough freezes', () => {
    expect(
      StreakRules.effectiveStreak({
        todayLocalDate: '2026-11-03',
        lastActiveLocalDate: '2026-11-01',
        streakDays: 7,
        freezeBalance: 1,
      })
    ).toBe(7);
  });
});
