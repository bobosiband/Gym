import { describe, expect, it } from 'vitest';

import { WORKOUT_LOGGED_V1_DETAIL_TYPE } from '../../packages/contracts/src/events/workoutLogged.v1.js';
import { LoggingServiceError } from '../../services/logging/src/service/LoggingServiceErrors.js';
import { buildLoggingService } from './support/buildLoggingService.js';

const USER_ID = 'user-1';
const KEY = 'client-key-12345';

describe('LoggingService.logWorkout', () => {
  it('persists a workout and publishes workout.logged.v1', async () => {
    const h = buildLoggingService();
    const response = await h.service.logWorkout({
      userId: USER_ID,
      body: { exerciseId: 'push-up', kind: 'pushup', reps: 20 },
    });
    expect(response.workout.userId).toBe(USER_ID);
    expect(response.workout.exerciseId).toBe('push-up');
    expect(response.workout.kind).toBe('pushup');
    expect(response.workout.reps).toBe(20);
    expect(h.workouts.all()).toHaveLength(1);
    expect(h.events.events).toHaveLength(1);
    expect(h.events.events[0]?.detailType).toBe(WORKOUT_LOGGED_V1_DETAIL_TYPE);
  });

  it('returns the same workout on an idempotent retry without duplicating', async () => {
    const h = buildLoggingService();
    const first = await h.service.logWorkout({
      userId: USER_ID,
      body: { exerciseId: 'bench', kind: 'set', reps: 5, weightKg: 100 },
      idempotencyKey: KEY,
    });
    const second = await h.service.logWorkout({
      userId: USER_ID,
      body: { exerciseId: 'bench', kind: 'set', reps: 5, weightKg: 100 },
      idempotencyKey: KEY,
    });
    expect(second).toEqual(first);
    expect(h.workouts.all()).toHaveLength(1);
    expect(h.events.events).toHaveLength(1);
  });

  it('resumes an in-progress idempotency row by re-publishing', async () => {
    const h = buildLoggingService();
    h.events.failOnce();
    await expect(
      h.service.logWorkout({
        userId: USER_ID,
        body: { exerciseId: 'squat', kind: 'set', reps: 5, weightKg: 80 },
        idempotencyKey: KEY,
      })
    ).rejects.toBeInstanceOf(LoggingServiceError);
    const row = h.idempotency.get(USER_ID, KEY);
    expect(row?.status).toBe('in_progress');
    const resumed = await h.service.logWorkout({
      userId: USER_ID,
      body: { exerciseId: 'squat', kind: 'set', reps: 5, weightKg: 80 },
      idempotencyKey: KEY,
    });
    expect(resumed.workout.workoutId).toBe(row?.workoutId);
    expect(h.events.events).toHaveLength(1);
    expect(h.idempotency.get(USER_ID, KEY)?.status).toBe('completed');
  });

  it('surfaces EVENT_PUBLISH_FAILED when retries keep failing', async () => {
    const h = buildLoggingService();
    h.events.failAlways();
    await expect(
      h.service.logWorkout({
        userId: USER_ID,
        body: { exerciseId: 'squat', kind: 'set', reps: 5 },
        idempotencyKey: KEY,
      })
    ).rejects.toMatchObject({ code: 'EVENT_PUBLISH_FAILED' });
    await expect(
      h.service.logWorkout({
        userId: USER_ID,
        body: { exerciseId: 'squat', kind: 'set', reps: 5 },
        idempotencyKey: KEY,
      })
    ).rejects.toMatchObject({ code: 'EVENT_PUBLISH_FAILED' });
    expect(h.events.events).toHaveLength(0);
  });

  it('without idempotency key, a publish failure surfaces as a service error', async () => {
    const h = buildLoggingService();
    h.events.failOnce();
    await expect(
      h.service.logWorkout({
        userId: USER_ID,
        body: { exerciseId: 'row', kind: 'set', reps: 10 },
      })
    ).rejects.toBeInstanceOf(LoggingServiceError);
    expect(h.workouts.all()).toHaveLength(1);
  });
});

describe('LoggingService.getWorkout', () => {
  it("returns the caller's own workout", async () => {
    const h = buildLoggingService();
    const first = await h.service.logWorkout({
      userId: USER_ID,
      body: { exerciseId: 'push-up', kind: 'pushup', reps: 10 },
    });
    const found = await h.service.getWorkout(USER_ID, first.workout.workoutId);
    expect(found).toEqual(first.workout);
  });

  it('404s on a workout owned by another user', async () => {
    const h = buildLoggingService();
    const first = await h.service.logWorkout({
      userId: USER_ID,
      body: { exerciseId: 'push-up', kind: 'pushup', reps: 10 },
    });
    await expect(h.service.getWorkout('user-2', first.workout.workoutId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('404s on an unknown id', async () => {
    const h = buildLoggingService();
    await expect(
      h.service.getWorkout(USER_ID, '00000000-0000-4000-8000-000000000999')
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('LoggingService.listWorkouts', () => {
  it("returns the caller's workouts newest first", async () => {
    const h = buildLoggingService();
    for (let i = 0; i < 3; i += 1) {
      await h.service.logWorkout({
        userId: USER_ID,
        body: { exerciseId: 'push-up', kind: 'pushup', reps: 5 + i },
      });
      h.clock.advanceSeconds(60);
    }
    const page = await h.service.listWorkouts(USER_ID, { limit: 10 });
    expect(page.workouts.map((w) => w.reps)).toEqual([7, 6, 5]);
  });

  it('paginates with a cursor', async () => {
    const h = buildLoggingService();
    for (let i = 0; i < 5; i += 1) {
      await h.service.logWorkout({
        userId: USER_ID,
        body: { exerciseId: 'x', kind: 'set', reps: i + 1 },
      });
      h.clock.advanceSeconds(60);
    }
    const first = await h.service.listWorkouts(USER_ID, { limit: 2 });
    expect(first.workouts).toHaveLength(2);
    expect(first.cursor).toBeDefined();
    const options = first.cursor === undefined ? { limit: 2 } : { limit: 2, cursor: first.cursor };
    const second = await h.service.listWorkouts(USER_ID, options);
    expect(second.workouts).toHaveLength(2);
    expect(second.workouts[0]?.workoutId).not.toBe(first.workouts[0]?.workoutId);
  });

  it('scopes to the caller only', async () => {
    const h = buildLoggingService();
    await h.service.logWorkout({
      userId: USER_ID,
      body: { exerciseId: 'a', kind: 'set', reps: 1 },
    });
    await h.service.logWorkout({
      userId: 'user-2',
      body: { exerciseId: 'b', kind: 'set', reps: 2 },
    });
    const page = await h.service.listWorkouts(USER_ID, { limit: 10 });
    expect(page.workouts).toHaveLength(1);
    expect(page.workouts[0]?.userId).toBe(USER_ID);
  });
});
