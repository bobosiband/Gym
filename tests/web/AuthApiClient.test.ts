import { describe, expect, it } from 'vitest';

import { AuthApiClient } from '../../apps/web/src/api/AuthApiClient.js';
import { FetchHttpClient } from '../../apps/web/src/api/FetchHttpClient.js';
import { ScriptedFetch } from './support/ScriptedFetch.js';

describe('AuthApiClient', () => {
  it('login returns tokens with the expected shape', async () => {
    const fetchStub = new ScriptedFetch([
      {
        url: 'https://auth/auth/login',
        method: 'POST',
        status: 200,
        body: {
          accessToken: 'a',
          refreshToken: 'r',
          tokenType: 'Bearer',
          expiresInSeconds: 900,
        },
      },
    ]);
    const client = new AuthApiClient(new FetchHttpClient(fetchStub.asFetch()), 'https://auth');
    const tokens = await client.login('x@y.z', 'passwordpassword');
    expect(tokens.accessToken).toBe('a');
    expect(tokens.refreshToken).toBe('r');
    expect(tokens.expiresInSeconds).toBe(900);
    expect(fetchStub.requests[0]!.body).toContain('"email":"x@y.z"');
    expect(fetchStub.requests[0]!.body).toContain('"password":"passwordpassword"');
  });

  it('me attaches the bearer token to GET /auth/me', async () => {
    const fetchStub = new ScriptedFetch([
      {
        url: 'https://auth/auth/me',
        method: 'GET',
        status: 200,
        body: {
          user: { id: 'u1', email: 'x@y.z', emailVerified: true, createdAt: '2026-01-01T00:00:00' },
        },
      },
    ]);
    const client = new AuthApiClient(new FetchHttpClient(fetchStub.asFetch()), 'https://auth');
    const me = await client.me('token-abc');
    expect(me.user.id).toBe('u1');
    expect(fetchStub.requests[0]!.headers['authorization']).toBe('Bearer token-abc');
  });

  it('forgot and reset forward the matching bodies', async () => {
    const fetchStub = new ScriptedFetch([
      {
        url: 'https://auth/auth/forgot-password',
        method: 'POST',
        status: 200,
        body: { status: 'pending_reset' },
      },
      {
        url: 'https://auth/auth/reset-password',
        method: 'POST',
        status: 200,
        body: { status: 'password_reset' },
      },
    ]);
    const client = new AuthApiClient(new FetchHttpClient(fetchStub.asFetch()), 'https://auth');
    await client.forgotPassword('x@y.z');
    await client.resetPassword('token', 'newpasswordnew1');
    expect(fetchStub.requests[0]!.body).toContain('"email":"x@y.z"');
    expect(fetchStub.requests[1]!.body).toContain('"token":"token"');
    expect(fetchStub.requests[1]!.body).toContain('"newPassword":"newpasswordnew1"');
  });
});
