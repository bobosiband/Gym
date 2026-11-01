import { describe, expect, it } from 'vitest';

import { LogWorkoutHandler } from '../../services/logging/src/handlers/LogWorkoutHandler.js';
import { buildLoggingService } from './support/buildLoggingService.js';
import { postEvent } from './support/events.js';

const USER_ID = 'user-abc';

describe('LogWorkoutHandler', () => {
  it('returns 201 and the workout for a valid request', async () => {
    const h = buildLoggingService();
    const response = await new LogWorkoutHandler(h.service, h.verifier).handle(
      postEvent(
        '/workouts',
        { exerciseId: 'push-up', kind: 'pushup', reps: 25 },
        {
          authorization: `Bearer ${USER_ID}`,
        }
      )
    );
    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body as string) as { workout: { userId: string } };
    expect(body.workout.userId).toBe(USER_ID);
  });

  it('returns 401 when no Authorization header is present', async () => {
    const h = buildLoggingService();
    const response = await new LogWorkoutHandler(h.service, h.verifier).handle(
      postEvent('/workouts', { exerciseId: 'push-up', kind: 'pushup', reps: 25 })
    );
    expect(response.statusCode).toBe(401);
  });

  it('returns 401 when the verifier rejects the token', async () => {
    const h = buildLoggingService();
    h.verifier.failNext(new Error('bad token'));
    const response = await new LogWorkoutHandler(h.service, h.verifier).handle(
      postEvent(
        '/workouts',
        { exerciseId: 'push-up', kind: 'pushup', reps: 25 },
        {
          authorization: 'Bearer bogus',
        }
      )
    );
    expect(response.statusCode).toBe(401);
  });

  it('returns 400 for an invalid body', async () => {
    const h = buildLoggingService();
    const response = await new LogWorkoutHandler(h.service, h.verifier).handle(
      postEvent(
        '/workouts',
        { exerciseId: 'push-up', kind: 'invalid', reps: 25 },
        {
          authorization: `Bearer ${USER_ID}`,
        }
      )
    );
    expect(response.statusCode).toBe(400);
  });

  it('returns 413 for an oversize body', async () => {
    const h = buildLoggingService();
    const bigString = 'x'.repeat(5000);
    const response = await new LogWorkoutHandler(h.service, h.verifier).handle(
      postEvent(
        '/workouts',
        { exerciseId: bigString, kind: 'set', reps: 1 },
        { authorization: `Bearer ${USER_ID}` }
      )
    );
    expect(response.statusCode).toBe(413);
  });

  it('returns 400 for a malformed Idempotency-Key header', async () => {
    const h = buildLoggingService();
    const response = await new LogWorkoutHandler(h.service, h.verifier).handle(
      postEvent(
        '/workouts',
        { exerciseId: 'push-up', kind: 'pushup', reps: 10 },
        {
          authorization: `Bearer ${USER_ID}`,
          'idempotency-key': 'nope',
        }
      )
    );
    expect(response.statusCode).toBe(400);
  });

  it('returns the cached response on an idempotent retry', async () => {
    const h = buildLoggingService();
    const headers = {
      authorization: `Bearer ${USER_ID}`,
      'idempotency-key': 'abcdef12345',
    };
    const body = { exerciseId: 'row', kind: 'set' as const, reps: 10 };
    const first = await new LogWorkoutHandler(h.service, h.verifier).handle(
      postEvent('/workouts', body, headers)
    );
    const second = await new LogWorkoutHandler(h.service, h.verifier).handle(
      postEvent('/workouts', body, headers)
    );
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.body).toBe(first.body);
    expect(h.workouts.all()).toHaveLength(1);
  });

  it('returns 503 when publishing persistently fails', async () => {
    const h = buildLoggingService();
    h.events.failAlways();
    const response = await new LogWorkoutHandler(h.service, h.verifier).handle(
      postEvent(
        '/workouts',
        { exerciseId: 'row', kind: 'set', reps: 10 },
        {
          authorization: `Bearer ${USER_ID}`,
          'idempotency-key': 'abcdef12345',
        }
      )
    );
    expect(response.statusCode).toBe(503);
  });
});
