import { describe, expect, it } from 'vitest';

import { FetchHttpClient } from '../../apps/web/src/api/FetchHttpClient.js';
import { LoggingApiClient } from '../../apps/web/src/api/LoggingApiClient.js';
import { ScriptedFetch } from './support/ScriptedFetch.js';

describe('LoggingApiClient', () => {
  it('forwards the idempotency-key header to POST /workouts', async () => {
    const fetchStub = new ScriptedFetch([
      {
        url: 'https://log/workouts',
        method: 'POST',
        status: 201,
        body: {
          workout: {
            workoutId: '00000000-0000-4000-8000-000000000000',
            userId: 'u1',
            loggedAt: '2026-01-01T00:00:00',
            exerciseId: 'pushup',
            kind: 'pushup',
            reps: 10,
          },
        },
      },
    ]);
    const client = new LoggingApiClient(new FetchHttpClient(fetchStub.asFetch()), 'https://log');
    const response = await client.logWorkout({
      request: { exerciseId: 'pushup', kind: 'pushup', reps: 10 },
      accessToken: 'tok',
      idempotencyKey: 'key-1234',
    });
    expect(response.workout.reps).toBe(10);
    expect(fetchStub.requests[0]!.headers['idempotency-key']).toBe('key-1234');
    expect(fetchStub.requests[0]!.headers['authorization']).toBe('Bearer tok');
  });

  it('encodes limit and cursor on GET /workouts', async () => {
    const fetchStub = new ScriptedFetch([
      {
        url: 'https://log/workouts?limit=20&cursor=abc',
        method: 'GET',
        status: 200,
        body: { workouts: [] },
      },
    ]);
    const client = new LoggingApiClient(new FetchHttpClient(fetchStub.asFetch()), 'https://log');
    const response = await client.listWorkouts({
      accessToken: 'tok',
      limit: 20,
      cursor: 'abc',
    });
    expect(response.workouts).toEqual([]);
    expect(fetchStub.requests[0]!.url).toBe('https://log/workouts?limit=20&cursor=abc');
  });

  it('omits the query string when no options are passed', async () => {
    const fetchStub = new ScriptedFetch([
      {
        url: 'https://log/workouts',
        method: 'GET',
        status: 200,
        body: { workouts: [] },
      },
    ]);
    const client = new LoggingApiClient(new FetchHttpClient(fetchStub.asFetch()), 'https://log');
    await client.listWorkouts({ accessToken: 'tok' });
    expect(fetchStub.requests[0]!.url).toBe('https://log/workouts');
  });
});
