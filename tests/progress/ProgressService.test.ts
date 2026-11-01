import { describe, expect, it } from 'vitest';

import type { WorkoutLoggedV1 } from '../../packages/contracts/src/events/workoutLogged.v1.js';
import { buildProgressService } from './support/buildProgressService.js';

function pushup(overrides: Partial<WorkoutLoggedV1>): WorkoutLoggedV1 {
  return {
    eventId: '00000000-0000-4000-8000-000000000000',
    userId: 'u1',
    workoutId: '00000000-0000-4000-8000-000000000001',
    loggedAt: '2026-11-02T00:00:00',
    exerciseId: 'pushup',
    kind: 'pushup',
    reps: 50,
    ...overrides,
  };
}

describe('ProgressService.getProgress', () => {
  it('seeds a fresh state row for a new user and reports level 1', async () => {
    const { service, progress } = buildProgressService();
    const state = await service.getProgress('u1');
    expect(state.userId).toBe('u1');
    expect(state.level).toBe(1);
    expect(state.xp).toBe(0);
    expect(state.streakDays).toBe(0);
    expect(state.freezeBalance).toBe(0);
    expect(state.lastActiveLocalDate).toBeNull();
    expect(progress.state.get('u1')).toBeDefined();
  });

  it('reflects the stored time zone in the response', async () => {
    const { service } = buildProgressService();
    await service.setTimeZone('u1', 'Australia/Sydney');
    const state = await service.getProgress('u1');
    expect(state.timeZone).toBe('Australia/Sydney');
  });
});

describe('ProgressService.setTimeZone', () => {
  it('rejects an invalid IANA zone', async () => {
    const { service } = buildProgressService();
    await expect(service.setTimeZone('u1', 'Not/A_Zone')).rejects.toSatisfy(
      (err: unknown) => err instanceof Error && err.message.includes('invalid IANA time zone')
    );
  });
});

describe('ProgressService.setDailyTarget', () => {
  it('stores a daily target with totalReps and remainingReps', async () => {
    const { service } = buildProgressService({ now: '2026-11-02T00:00:00' });
    await service.setTimeZone('u1', 'Australia/Sydney');
    const state = await service.setDailyTarget('u1', { repsPerDay: 100, durationDays: 30 });
    expect(state.dailyTarget).toEqual({
      repsPerDay: 100,
      durationDays: 30,
      startLocalDate: '2026-11-02',
      totalReps: 3_000,
      remainingReps: 3_000,
      completedDays: 0,
    });
  });
});

describe('ProgressService.handleWorkoutLogged', () => {
  it('ignores a replayed event', async () => {
    const { service, processed } = buildProgressService();
    await service.setTimeZone('u1', 'Australia/Sydney');
    await service.handleWorkoutLogged(pushup({ eventId: 'ev-1' }));
    await service.handleWorkoutLogged(pushup({ eventId: 'ev-1', reps: 1_000 }));
    const state = await service.getProgress('u1');
    expect(state.xp).toBe(5);
    expect(processed.claimed.size).toBe(1);
  });

  it('counts XP for a push-up event and reports level progression', async () => {
    const { service } = buildProgressService();
    await service.setTimeZone('u1', 'Australia/Sydney');
    await service.handleWorkoutLogged(pushup({ eventId: 'ev-1', reps: 100 }));
    const state = await service.getProgress('u1');
    expect(state.xp).toBe(10);
    expect(state.level).toBe(1);
  });

  it('awards the daily-target bonus once per target hit day', async () => {
    const { service } = buildProgressService({ now: '2026-11-02T00:00:00' });
    await service.setTimeZone('u1', 'Australia/Sydney');
    await service.setDailyTarget('u1', { repsPerDay: 100, durationDays: 30 });
    await service.handleWorkoutLogged(
      pushup({ eventId: 'ev-1', reps: 50, loggedAt: '2026-11-02T00:00:00' })
    );
    const partway = await service.getProgress('u1');
    expect(partway.dailyTarget?.remainingReps).toBe(2_950);
    expect(partway.dailyTarget?.completedDays).toBe(0);
    expect(partway.streakDays).toBe(0);
    await service.handleWorkoutLogged(
      pushup({ eventId: 'ev-2', reps: 60, loggedAt: '2026-11-02T00:00:00' })
    );
    const state = await service.getProgress('u1');
    expect(state.dailyTarget?.remainingReps).toBe(2_890);
    expect(state.dailyTarget?.completedDays).toBe(1);
    expect(state.streakDays).toBe(1);
    expect(state.xp).toBe(5 + 6 + 50);
  });

  it('emits streak.broken.v1 and resets the streak on a missed day', async () => {
    const { service, events } = buildProgressService();
    await service.setTimeZone('u1', 'Australia/Sydney');
    await service.setDailyTarget('u1', { repsPerDay: 100, durationDays: 30 });
    await service.handleWorkoutLogged(
      pushup({ eventId: 'ev-1', reps: 100, loggedAt: '2026-11-02T00:00:00' })
    );
    await service.handleWorkoutLogged(
      pushup({ eventId: 'ev-2', reps: 100, loggedAt: '2026-11-05T00:00:00' })
    );
    const state = await service.getProgress('u1');
    expect(state.streakDays).toBe(1);
    const broken = events.events.find((e) => e.detailType === 'streak.broken.v1');
    expect(broken?.detail['previousStreakDays']).toBe(1);
    expect(broken?.detail['missedDays']).toBe(2);
  });

  it('emits streak.frozen.v1 when a freeze covers the missed day', async () => {
    const { service, events } = buildProgressService();
    await service.setTimeZone('u1', 'Australia/Sydney');
    await service.setDailyTarget('u1', { repsPerDay: 100, durationDays: 30 });
    await service.grantFreezes('u1', 2);
    await service.handleWorkoutLogged(
      pushup({ eventId: 'ev-1', reps: 100, loggedAt: '2026-11-02T00:00:00' })
    );
    await service.handleWorkoutLogged(
      pushup({ eventId: 'ev-2', reps: 100, loggedAt: '2026-11-04T00:00:00' })
    );
    const state = await service.getProgress('u1');
    expect(state.streakDays).toBe(3);
    expect(state.freezeBalance).toBe(1);
    const frozen = events.events.find((e) => e.detailType === 'streak.frozen.v1');
    expect(frozen?.detail['remainingFreezes']).toBe(1);
    expect(frozen?.detail['streakDaysAfter']).toBe(3);
  });

  it('emits progress.level_up.v1 when the user crosses a level', async () => {
    const { service, events } = buildProgressService();
    await service.setTimeZone('u1', 'Australia/Sydney');
    await service.setDailyTarget('u1', { repsPerDay: 100, durationDays: 30 });
    for (let i = 0; i < 7; i += 1) {
      const date = `2026-11-${(2 + i).toString().padStart(2, '0')}T00:00:00`;
      await service.handleWorkoutLogged(pushup({ eventId: `ev-${i}`, reps: 100, loggedAt: date }));
    }
    const state = await service.getProgress('u1');
    expect(state.xp).toBeGreaterThanOrEqual(400);
    const levelUp = events.events.find((e) => e.detailType === 'progress.level_up.v1');
    expect(levelUp).toBeDefined();
    expect(levelUp?.detail['newLevel']).toBe(2);
  });

  it('counts a resistance set as an active day for the streak even without a target', async () => {
    const { service } = buildProgressService();
    await service.setTimeZone('u1', 'Australia/Sydney');
    await service.handleWorkoutLogged({
      eventId: 'ev-1',
      userId: 'u1',
      workoutId: '00000000-0000-4000-8000-000000000003',
      loggedAt: '2026-11-02T00:00:00',
      exerciseId: 'bench-press',
      kind: 'set',
      reps: 8,
      weightKg: 60,
    });
    const state = await service.getProgress('u1');
    expect(state.streakDays).toBe(1);
    expect(state.xp).toBe(10);
  });

  it('respects the user time zone when deciding the local date', async () => {
    const { service, progress } = buildProgressService();
    await service.setTimeZone('u1', 'Australia/Sydney');
    await service.handleWorkoutLogged(pushup({ eventId: 'ev-1', loggedAt: '2026-11-01T13:30:00' }));
    const summaries = Array.from(progress.summaries.keys());
    expect(summaries).toContain('u1#2026-11-02');
  });
});

describe('ProgressService.grantFreezes', () => {
  it('caps the balance at the global maximum', async () => {
    const { service } = buildProgressService();
    await service.grantFreezes('u1', 5);
    const state = await service.getProgress('u1');
    expect(state.freezeBalance).toBe(2);
  });
});
