import { describe, expect, it } from 'vitest';

import { buildAchievementService } from './support/buildAchievementService.js';

const USER = 'u1';

function workout(overrides: { eventId: string; reps: number; loggedAt?: string; kind?: string }): {
  eventId: string;
  userId: string;
  workoutId: string;
  loggedAt: string;
  exerciseId: string;
  kind: string;
  reps: number;
} {
  return {
    eventId: overrides.eventId,
    userId: USER,
    workoutId: '00000000-0000-4000-8000-000000000001',
    loggedAt: overrides.loggedAt ?? '2026-11-02T00:00:00',
    exerciseId: 'pushup',
    kind: overrides.kind ?? 'pushup',
    reps: overrides.reps,
  };
}

function levelUp(
  eventId: string,
  newLevel: number
): {
  eventId: string;
  userId: string;
  previousLevel: number;
  newLevel: number;
  xpTotal: number;
  occurredAt: string;
} {
  return {
    eventId,
    userId: USER,
    previousLevel: Math.max(1, newLevel - 1),
    newLevel,
    xpTotal: 100 * newLevel * newLevel,
    occurredAt: '2026-11-02T00:00:00',
  };
}

describe('AchievementService.handleWorkoutLogged', () => {
  it('unlocks the first-workout badge on the first event and only once', async () => {
    const { service, repo } = buildAchievementService();
    const first = await service.handleWorkoutLogged(workout({ eventId: 'ev-1', reps: 10 }));
    expect(first.map((r) => r.badgeId)).toContain('first-workout');
    const second = await service.handleWorkoutLogged(workout({ eventId: 'ev-2', reps: 10 }));
    expect(second.map((r) => r.badgeId)).not.toContain('first-workout');
    const list = await repo.listAchievements(USER);
    expect(list.filter((r) => r.badgeId === 'first-workout').length).toBe(1);
  });

  it('is idempotent on replayed events', async () => {
    const { service, repo } = buildAchievementService();
    await service.handleWorkoutLogged(workout({ eventId: 'ev-1', reps: 10 }));
    await service.handleWorkoutLogged(workout({ eventId: 'ev-1', reps: 10 }));
    const snapshot = repo.snapshots.get(USER);
    expect(snapshot?.totalWorkouts).toBe(1);
    expect(snapshot?.totalReps).toBe(10);
  });

  it('unlocks the century-club badge at 100 total reps', async () => {
    const { service } = buildAchievementService();
    const result = await service.handleWorkoutLogged(workout({ eventId: 'ev-1', reps: 100 }));
    expect(result.map((r) => r.badgeId)).toEqual(
      expect.arrayContaining(['first-workout', 'total-reps-100'])
    );
  });

  it('emits achievement.unlocked.v1 for every freshly unlocked badge', async () => {
    const { service, events } = buildAchievementService();
    await service.handleWorkoutLogged(workout({ eventId: 'ev-1', reps: 100 }));
    const detailTypes = events.events.map((e) => e.detailType);
    expect(detailTypes).toEqual(['achievement.unlocked.v1', 'achievement.unlocked.v1']);
  });
});

describe('AchievementService.handleProgressLevelUp', () => {
  it('unlocks the level-5 badge when the user hits level 5', async () => {
    const { service } = buildAchievementService();
    const result = await service.handleProgressLevelUp(levelUp('ev-1', 5));
    expect(result.map((r) => r.badgeId)).toContain('level-5');
  });

  it('does not downgrade the stored highest level', async () => {
    const { service, repo } = buildAchievementService();
    await service.handleProgressLevelUp(levelUp('ev-1', 5));
    await service.handleProgressLevelUp(levelUp('ev-2', 3));
    expect(repo.snapshots.get(USER)?.highestLevel).toBe(5);
  });
});

describe('SevenDayStreakBadge', () => {
  it('unlocks on seven consecutive active days', async () => {
    const { service } = buildAchievementService();
    for (let day = 2; day <= 8; day += 1) {
      const iso = `2026-11-${day.toString().padStart(2, '0')}T12:00:00`;
      await service.handleWorkoutLogged(workout({ eventId: `ev-${day}`, reps: 10, loggedAt: iso }));
    }
    const list = await service.listAchievements(USER);
    expect(list.map((r) => r.badgeId)).toContain('seven-day-streak');
  });

  it('does not unlock when a gap breaks the run', async () => {
    const { service } = buildAchievementService();
    const days = [2, 3, 4, 5, 7, 8, 9];
    for (const [idx, day] of days.entries()) {
      const iso = `2026-11-${day.toString().padStart(2, '0')}T12:00:00`;
      await service.handleWorkoutLogged(workout({ eventId: `ev-${idx}`, reps: 10, loggedAt: iso }));
    }
    const list = await service.listAchievements(USER);
    expect(list.map((r) => r.badgeId)).not.toContain('seven-day-streak');
  });
});
