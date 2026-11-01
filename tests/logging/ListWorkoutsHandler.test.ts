import { describe, expect, it } from 'vitest';

import { ListWorkoutsHandler } from '../../services/logging/src/handlers/ListWorkoutsHandler.js';
import { buildLoggingService } from './support/buildLoggingService.js';
import { getEvent } from './support/events.js';

const USER_ID = 'user-a';

async function seed(h: ReturnType<typeof buildLoggingService>, count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await h.service.logWorkout({
      userId: USER_ID,
      body: { exerciseId: 'push-up', kind: 'pushup', reps: i + 1 },
    });
    h.clock.advanceSeconds(60);
  }
}

describe('ListWorkoutsHandler', () => {
  it("returns the caller's workouts newest first", async () => {
    const h = buildLoggingService();
    await seed(h, 3);
    const response = await new ListWorkoutsHandler(h.service, h.verifier).handle(
      getEvent('/workouts', {}, { authorization: `Bearer ${USER_ID}` })
    );
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body as string) as { workouts: { reps: number }[] };
    expect(body.workouts.map((w) => w.reps)).toEqual([3, 2, 1]);
  });

  it('paginates with cursor', async () => {
    const h = buildLoggingService();
    await seed(h, 5);
    const first = await new ListWorkoutsHandler(h.service, h.verifier).handle(
      getEvent('/workouts', { limit: '2' }, { authorization: `Bearer ${USER_ID}` })
    );
    const firstBody = JSON.parse(first.body as string) as {
      workouts: unknown[];
      cursor: string;
    };
    expect(firstBody.workouts).toHaveLength(2);
    expect(firstBody.cursor).toBeDefined();
    const second = await new ListWorkoutsHandler(h.service, h.verifier).handle(
      getEvent(
        '/workouts',
        { limit: '2', cursor: firstBody.cursor },
        {
          authorization: `Bearer ${USER_ID}`,
        }
      )
    );
    const secondBody = JSON.parse(second.body as string) as { workouts: unknown[] };
    expect(secondBody.workouts).toHaveLength(2);
  });

  it('400s on an invalid limit', async () => {
    const h = buildLoggingService();
    const response = await new ListWorkoutsHandler(h.service, h.verifier).handle(
      getEvent('/workouts', { limit: '0' }, { authorization: `Bearer ${USER_ID}` })
    );
    expect(response.statusCode).toBe(400);
  });

  it('401s without a token', async () => {
    const h = buildLoggingService();
    const response = await new ListWorkoutsHandler(h.service, h.verifier).handle(
      getEvent('/workouts', {})
    );
    expect(response.statusCode).toBe(401);
  });
});
