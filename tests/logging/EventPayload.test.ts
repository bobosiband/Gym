import { describe, expect, it } from 'vitest';

import {
  WORKOUT_LOGGED_V1_DETAIL_TYPE,
  workoutLoggedV1Schema,
} from '../../packages/contracts/src/events/workoutLogged.v1.js';
import { buildLoggingService } from './support/buildLoggingService.js';

const USER_ID = 'user-ev';

describe('workout.logged.v1 payload shape', () => {
  it('publishes a payload that matches the Zod schema', async () => {
    const h = buildLoggingService();
    await h.service.logWorkout({
      userId: USER_ID,
      body: { exerciseId: 'push-up', kind: 'pushup', reps: 20 },
    });
    expect(h.events.events).toHaveLength(1);
    const first = h.events.events[0];
    expect(first?.detailType).toBe(WORKOUT_LOGGED_V1_DETAIL_TYPE);
    const result = workoutLoggedV1Schema.safeParse(first?.detail);
    expect(result.success).toBe(true);
  });

  it('includes optional weightKg and durationSeconds when present', async () => {
    const h = buildLoggingService();
    await h.service.logWorkout({
      userId: USER_ID,
      body: {
        exerciseId: 'squat',
        kind: 'set',
        reps: 5,
        weightKg: 100,
        durationSeconds: 90,
      },
    });
    const detail = h.events.events[0]?.detail as Record<string, unknown>;
    expect(detail['weightKg']).toBe(100);
    expect(detail['durationSeconds']).toBe(90);
  });

  it('omits optional fields when not supplied', async () => {
    const h = buildLoggingService();
    await h.service.logWorkout({
      userId: USER_ID,
      body: { exerciseId: 'push-up', kind: 'pushup', reps: 5 },
    });
    const detail = h.events.events[0]?.detail as Record<string, unknown>;
    expect(detail).not.toHaveProperty('weightKg');
    expect(detail).not.toHaveProperty('durationSeconds');
  });
});
