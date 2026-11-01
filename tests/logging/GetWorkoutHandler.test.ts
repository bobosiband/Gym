import { describe, expect, it } from 'vitest';

import { GetWorkoutHandler } from '../../services/logging/src/handlers/GetWorkoutHandler.js';
import { buildLoggingService } from './support/buildLoggingService.js';
import { getEvent } from './support/events.js';

const USER_ID = 'user-a';

describe('GetWorkoutHandler', () => {
  it('returns the workout for its owner', async () => {
    const h = buildLoggingService();
    const created = await h.service.logWorkout({
      userId: USER_ID,
      body: { exerciseId: 'push-up', kind: 'pushup', reps: 15 },
    });
    const response = await new GetWorkoutHandler(h.service, h.verifier).handle(
      getEvent(
        `/workouts/${created.workout.workoutId}`,
        {},
        { authorization: `Bearer ${USER_ID}` },
        { workoutId: created.workout.workoutId }
      )
    );
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body as string) as { workout: { workoutId: string } };
    expect(body.workout.workoutId).toBe(created.workout.workoutId);
  });

  it('404s on a workout owned by someone else', async () => {
    const h = buildLoggingService();
    const created = await h.service.logWorkout({
      userId: 'other-user',
      body: { exerciseId: 'row', kind: 'set', reps: 3 },
    });
    const response = await new GetWorkoutHandler(h.service, h.verifier).handle(
      getEvent(
        `/workouts/${created.workout.workoutId}`,
        {},
        { authorization: `Bearer ${USER_ID}` },
        { workoutId: created.workout.workoutId }
      )
    );
    expect(response.statusCode).toBe(404);
  });

  it('404s on an unknown id', async () => {
    const h = buildLoggingService();
    const response = await new GetWorkoutHandler(h.service, h.verifier).handle(
      getEvent(
        '/workouts/00000000-0000-4000-8000-00000000ffff',
        {},
        { authorization: `Bearer ${USER_ID}` },
        { workoutId: '00000000-0000-4000-8000-00000000ffff' }
      )
    );
    expect(response.statusCode).toBe(404);
  });

  it('401s without a token', async () => {
    const h = buildLoggingService();
    const response = await new GetWorkoutHandler(h.service, h.verifier).handle(
      getEvent('/workouts/any', {}, {}, { workoutId: 'any' })
    );
    expect(response.statusCode).toBe(401);
  });
});
