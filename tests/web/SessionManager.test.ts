import { describe, expect, it } from 'vitest';

import { AuthApiClient } from '../../apps/web/src/api/AuthApiClient.js';
import { FetchHttpClient } from '../../apps/web/src/api/FetchHttpClient.js';
import { SessionManager } from '../../apps/web/src/auth/SessionManager.js';
import { TokenStore } from '../../apps/web/src/auth/TokenStore.js';
import { InMemoryStorage } from './support/InMemoryStorage.js';
import { ScriptedFetch } from './support/ScriptedFetch.js';

function newSession(fetchStub: ScriptedFetch, storage: InMemoryStorage): SessionManager {
  const http = new FetchHttpClient(fetchStub.asFetch());
  const authApi = new AuthApiClient(http, 'https://auth');
  const store = new TokenStore(storage, () => 1_700_000_000_000);
  return new SessionManager(store, authApi);
}

describe('SessionManager', () => {
  it('serialises concurrent refresh requests into one HTTP call', async () => {
    const storage = new InMemoryStorage();
    storage.setItem(
      'gym.auth.tokens.v1',
      JSON.stringify({
        accessToken: 'old',
        refreshToken: 'r1',
        accessExpiresAtMs: 0,
      })
    );
    const fetchStub = new ScriptedFetch([
      {
        url: 'https://auth/auth/refresh',
        method: 'POST',
        status: 200,
        body: {
          accessToken: 'new',
          refreshToken: 'r2',
          tokenType: 'Bearer',
          expiresInSeconds: 900,
        },
      },
    ]);
    const session = newSession(fetchStub, storage);
    const [a, b, c] = await Promise.all([
      session.refreshNow(),
      session.refreshNow(),
      session.refreshNow(),
    ]);
    expect([a, b, c]).toEqual(['new', 'new', 'new']);
    expect(fetchStub.remaining()).toBe(0);
  });

  it('clears tokens and notifies listeners on refresh failure', async () => {
    const storage = new InMemoryStorage();
    storage.setItem(
      'gym.auth.tokens.v1',
      JSON.stringify({
        accessToken: 'old',
        refreshToken: 'r1',
        accessExpiresAtMs: 0,
      })
    );
    const fetchStub = new ScriptedFetch([
      {
        url: 'https://auth/auth/refresh',
        method: 'POST',
        status: 401,
        body: { code: 'UNAUTHORIZED', message: 'nope' },
      },
    ]);
    const session = newSession(fetchStub, storage);
    let notified = 0;
    session.onLogout(() => {
      notified += 1;
    });
    await expect(session.refreshNow()).rejects.toBeDefined();
    expect(notified).toBe(1);
    expect(session.hasSession()).toBe(false);
  });

  it('logout revokes server-side and clears local tokens', async () => {
    const storage = new InMemoryStorage();
    storage.setItem(
      'gym.auth.tokens.v1',
      JSON.stringify({
        accessToken: 'a',
        refreshToken: 'r',
        accessExpiresAtMs: Date.now() + 60_000,
      })
    );
    const fetchStub = new ScriptedFetch([
      {
        url: 'https://auth/auth/logout',
        method: 'POST',
        status: 200,
        body: { status: 'logged_out' },
      },
    ]);
    const session = newSession(fetchStub, storage);
    let notified = 0;
    session.onLogout(() => {
      notified += 1;
    });
    await session.logout();
    expect(session.hasSession()).toBe(false);
    expect(notified).toBe(1);
    expect(fetchStub.requests[0]!.body).toContain('"refreshToken":"r"');
  });

  it('returns the current access token when it is still fresh', async () => {
    const storage = new InMemoryStorage();
    const now = 1_700_000_000_000;
    storage.setItem(
      'gym.auth.tokens.v1',
      JSON.stringify({
        accessToken: 'live',
        refreshToken: 'r',
        accessExpiresAtMs: now + 10 * 60_000,
      })
    );
    const fetchStub = new ScriptedFetch([]);
    const session = newSession(fetchStub, storage);
    const token = await session.getFreshAccessToken();
    expect(token).toBe('live');
    expect(fetchStub.requests).toHaveLength(0);
  });
});
