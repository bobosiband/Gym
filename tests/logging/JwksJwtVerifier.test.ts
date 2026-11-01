import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { JwksJwtVerifier } from '../../services/logging/src/tokens/JwksJwtVerifier.js';

const ISSUER = 'https://auth.gym.test';
const AUDIENCE = 'gym-api';
const KEY_ID = 'test-key';

interface Fixture {
  server: Server;
  jwksUrl: string;
  signingKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
}

async function buildFixture(): Promise<Fixture> {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const jwk = await exportJWK(publicKey);
  const document = { keys: [{ ...jwk, kid: KEY_ID, alg: 'ES256', use: 'sig' }] };
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(document));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  const jwksUrl = `http://127.0.0.1:${addr.port}/jwks.json`;
  return { server, jwksUrl, signingKey: privateKey };
}

async function mintToken(signingKey: Fixture['signingKey'], sub: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(signingKey);
}

let fixture: Fixture;

beforeAll(async () => {
  fixture = await buildFixture();
});

afterAll(() => {
  fixture.server.close();
});

describe('JwksJwtVerifier', () => {
  it('verifies a valid ES256 token issued by auth', async () => {
    const verifier = new JwksJwtVerifier(fixture.jwksUrl, ISSUER, AUDIENCE);
    const token = await mintToken(fixture.signingKey, 'user-123');
    const claims = await verifier.verify(token);
    expect(claims.sub).toBe('user-123');
    expect(claims.iss).toBe(ISSUER);
    expect(claims.aud).toBe(AUDIENCE);
  });

  it('rejects a token with the wrong audience', async () => {
    const verifier = new JwksJwtVerifier(fixture.jwksUrl, ISSUER, 'wrong');
    const token = await mintToken(fixture.signingKey, 'user-123');
    await expect(verifier.verify(token)).rejects.toBeTruthy();
  });

  it('rejects a token with the wrong issuer', async () => {
    const verifier = new JwksJwtVerifier(fixture.jwksUrl, 'https://wrong', AUDIENCE);
    const token = await mintToken(fixture.signingKey, 'user-123');
    await expect(verifier.verify(token)).rejects.toBeTruthy();
  });

  it('rejects garbage', async () => {
    const verifier = new JwksJwtVerifier(fixture.jwksUrl, ISSUER, AUDIENCE);
    await expect(verifier.verify('not-a-jwt')).rejects.toBeTruthy();
  });
});
