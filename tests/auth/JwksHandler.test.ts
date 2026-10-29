import { generateKeyPairSync } from 'node:crypto';

import { importSPKI } from 'jose';
import { describe, expect, it } from 'vitest';

import { JwksHandler } from '../../services/auth/src/handlers/JwksHandler.js';

async function buildHandler(): Promise<JwksHandler> {
  const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
  return new JwksHandler(await importSPKI(pem, 'ES256'), 'test-key');
}

describe('JwksHandler', () => {
  it('returns a JWKS document with the service public key', async () => {
    const handler = await buildHandler();
    const response = await handler.handle();
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body as string);
    expect(body.keys).toHaveLength(1);
    const key = body.keys[0];
    expect(key.kty).toBe('EC');
    expect(key.crv).toBe('P-256');
    expect(key.alg).toBe('ES256');
    expect(key.use).toBe('sig');
    expect(key.kid).toBe('test-key');
    expect(typeof key.x).toBe('string');
    expect(typeof key.y).toBe('string');
  });

  it('sets a cache-control header for the JWKS document', async () => {
    const handler = await buildHandler();
    const response = await handler.handle();
    expect(response.headers?.['cache-control']).toContain('public');
    expect(response.headers?.['cache-control']).toContain('max-age=');
  });

  it('caches the document across calls (same object)', async () => {
    const handler = await buildHandler();
    const first = await handler.handle();
    const second = await handler.handle();
    expect(first.body).toBe(second.body);
  });
});
