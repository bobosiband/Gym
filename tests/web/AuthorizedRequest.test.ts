import { describe, expect, it } from 'vitest';

import { HttpError } from '../../apps/web/src/api/HttpError.js';
import { AuthorizedRequest } from '../../apps/web/src/auth/AuthorizedRequest.js';
import type { SessionManager } from '../../apps/web/src/auth/SessionManager.js';

function fakeSession(responses: readonly string[]): SessionManager {
  const queue = [...responses];
  const take = async (): Promise<string> => {
    const next = queue.shift();
    if (next === undefined) {
      throw new HttpError(401, 'UNAUTHORIZED', 'no tokens left');
    }
    return next;
  };
  return {
    login: () => undefined,
    hasSession: () => true,
    getFreshAccessToken: take,
    refreshNow: take,
    logout: async () => undefined,
    onLogout: () => () => undefined,
  } as unknown as SessionManager;
}

describe('AuthorizedRequest', () => {
  it('retries exactly once on a 401 and succeeds with the new token', async () => {
    const session = fakeSession(['t1', 't2']);
    const authorized = new AuthorizedRequest(session);
    let attempt = 0;
    const result = await authorized.run(async (token) => {
      attempt += 1;
      if (attempt === 1 && token === 't1') {
        throw new HttpError(401, 'UNAUTHORIZED', 'expired');
      }
      return `done:${token}`;
    });
    expect(result).toBe('done:t2');
    expect(attempt).toBe(2);
  });

  it('does not retry on an unrelated HttpError', async () => {
    const session = fakeSession(['t1']);
    const authorized = new AuthorizedRequest(session);
    await expect(
      authorized.run(async () => {
        throw new HttpError(500, 'INTERNAL', 'boom');
      })
    ).rejects.toSatisfy((e: unknown) => e instanceof HttpError && (e as HttpError).status === 500);
  });

  it('propagates refresh failures from the session manager', async () => {
    const session = fakeSession(['t1']);
    const authorized = new AuthorizedRequest(session);
    await expect(
      authorized.run(async () => {
        throw new HttpError(401, 'UNAUTHORIZED', 'expired');
      })
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof HttpError && (e as HttpError).code === 'UNAUTHORIZED'
    );
  });
});
