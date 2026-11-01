import { describe, expect, it } from 'vitest';

import { TokenStore } from '../../apps/web/src/auth/TokenStore.js';
import { InMemoryStorage } from './support/InMemoryStorage.js';

describe('TokenStore', () => {
  it('round-trips the saved tokens', () => {
    const storage = new InMemoryStorage();
    const store = new TokenStore(storage, () => 1_700_000_000_000);
    store.save({ accessToken: 'a', refreshToken: 'r', expiresInSeconds: 900 });
    expect(store.readAccessToken()).toBe('a');
    expect(store.readRefreshToken()).toBe('r');
    expect(store.hasSession()).toBe(true);
  });

  it('reports no session when storage is empty', () => {
    const store = new TokenStore(new InMemoryStorage());
    expect(store.readAccessToken()).toBeNull();
    expect(store.readRefreshToken()).toBeNull();
    expect(store.hasSession()).toBe(false);
    expect(store.isAccessTokenExpiring()).toBe(true);
  });

  it('clear() removes the stored blob', () => {
    const storage = new InMemoryStorage();
    const store = new TokenStore(storage);
    store.save({ accessToken: 'a', refreshToken: 'r', expiresInSeconds: 900 });
    store.clear();
    expect(storage.size()).toBe(0);
    expect(store.hasSession()).toBe(false);
  });

  it('treats tokens near expiry as expiring', () => {
    const base = 1_700_000_000_000;
    let now = base;
    const store = new TokenStore(new InMemoryStorage(), () => now);
    store.save({ accessToken: 'a', refreshToken: 'r', expiresInSeconds: 300 });
    expect(store.isAccessTokenExpiring()).toBe(false);
    now = base + 200_000;
    expect(store.isAccessTokenExpiring()).toBe(false);
    now = base + 250_000;
    expect(store.isAccessTokenExpiring()).toBe(true);
  });

  it('returns null when storage contains a malformed blob', () => {
    const storage = new InMemoryStorage();
    storage.setItem('gym.auth.tokens.v1', 'not json');
    const store = new TokenStore(storage);
    expect(store.readAccessToken()).toBeNull();
    expect(store.hasSession()).toBe(false);
  });

  it('returns null when the stored blob is missing required fields', () => {
    const storage = new InMemoryStorage();
    storage.setItem('gym.auth.tokens.v1', JSON.stringify({ accessToken: 'a' }));
    const store = new TokenStore(storage);
    expect(store.hasSession()).toBe(false);
  });
});
