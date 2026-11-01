import { describe, expect, it } from 'vitest';

import { FetchHttpClient } from '../../apps/web/src/api/FetchHttpClient.js';
import { HttpError } from '../../apps/web/src/api/HttpError.js';
import { ScriptedFetch } from './support/ScriptedFetch.js';

describe('FetchHttpClient', () => {
  it('serialises JSON body and attaches the bearer header', async () => {
    const fetchStub = new ScriptedFetch([
      { url: 'https://api/example', method: 'POST', status: 200, body: { ok: true } },
    ]);
    const client = new FetchHttpClient(fetchStub.asFetch());
    const result = await client.request<{ ok: boolean }>({
      method: 'POST',
      url: 'https://api/example',
      body: { reps: 10 },
      bearerToken: 'abc',
      headers: { 'idempotency-key': 'k1' },
    });
    expect(result.ok).toBe(true);
    const request = fetchStub.requests[0]!;
    expect(request.body).toBe('{"reps":10}');
    expect(request.headers['authorization']).toBe('Bearer abc');
    expect(request.headers['idempotency-key']).toBe('k1');
    expect(request.headers['content-type']).toBe('application/json');
    expect(request.headers['accept']).toBe('application/json');
  });

  it('maps a non-2xx JSON body to HttpError with its code', async () => {
    const fetchStub = new ScriptedFetch([
      {
        url: 'https://api/example',
        method: 'GET',
        status: 401,
        body: { code: 'UNAUTHORIZED', message: 'nope' },
      },
    ]);
    const client = new FetchHttpClient(fetchStub.asFetch());
    await expect(client.request({ method: 'GET', url: 'https://api/example' })).rejects.toSatisfy(
      (e: unknown) => e instanceof HttpError && (e as HttpError).code === 'UNAUTHORIZED'
    );
  });

  it('returns undefined for a 204 response', async () => {
    const fetchStub = new ScriptedFetch([
      { url: 'https://api/example', method: 'DELETE', status: 204 },
    ]);
    const client = new FetchHttpClient(fetchStub.asFetch());
    const result = await client.request<undefined>({
      method: 'DELETE',
      url: 'https://api/example',
    });
    expect(result).toBeUndefined();
  });

  it('falls back to a synthetic error when the server body is not JSON', async () => {
    const fetchStub = new ScriptedFetch([
      {
        url: 'https://api/example',
        method: 'GET',
        status: 500,
        body: 'oops',
        headers: { 'content-type': 'text/plain' },
      },
    ]);
    const client = new FetchHttpClient(fetchStub.asFetch());
    await expect(client.request({ method: 'GET', url: 'https://api/example' })).rejects.toSatisfy(
      (e: unknown) => e instanceof HttpError && (e as HttpError).status === 500
    );
  });
});
