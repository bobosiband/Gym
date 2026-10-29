import { generateKeyPairSync } from 'node:crypto';

import { importPKCS8, importSPKI } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';

import { JoseJwtSigner } from '../../services/auth/src/tokens/JoseJwtSigner.js';
import type { AccessTokenClaims } from '../../services/auth/src/tokens/TokenPayloads.js';

const ISSUER = 'https://auth.gym.test';
const AUDIENCE = 'gym-api';
const KEY_ID = 'test-key';

async function buildSigner(): Promise<JoseJwtSigner> {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const privKey = await importPKCS8(privateKeyPem, 'ES256');
  const pubKey = await importSPKI(publicKeyPem, 'ES256');
  return new JoseJwtSigner(privKey, pubKey, KEY_ID, ISSUER, AUDIENCE);
}

describe('JoseJwtSigner', () => {
  let signer: JoseJwtSigner;
  let now: number;
  let claims: AccessTokenClaims;

  beforeAll(async () => {
    signer = await buildSigner();
    now = Math.floor(Date.now() / 1000);
    claims = { iss: ISSUER, aud: AUDIENCE, sub: 'user-1', iat: now, exp: now + 60 };
  });

  it('signs and verifies a well-formed access token', async () => {
    const token = await signer.sign(claims);
    const decoded = await signer.verify(token, ISSUER, AUDIENCE);
    expect(decoded.sub).toBe('user-1');
    expect(decoded.iss).toBe(ISSUER);
    expect(decoded.aud).toBe(AUDIENCE);
  });

  it('rejects an expired token', async () => {
    const expired: AccessTokenClaims = { ...claims, iat: now - 120, exp: now - 60 };
    const token = await signer.sign(expired);
    await expect(signer.verify(token, ISSUER, AUDIENCE)).rejects.toThrow();
  });

  it('rejects a token with the wrong issuer', async () => {
    const token = await signer.sign(claims);
    await expect(signer.verify(token, 'https://evil.example', AUDIENCE)).rejects.toThrow();
  });

  it('rejects a token with the wrong audience', async () => {
    const token = await signer.sign(claims);
    await expect(signer.verify(token, ISSUER, 'wrong-audience')).rejects.toThrow();
  });

  it('rejects a tampered token', async () => {
    const token = await signer.sign(claims);
    const tampered = `${token.slice(0, -4)}AAAA`;
    await expect(signer.verify(tampered, ISSUER, AUDIENCE)).rejects.toThrow();
  });
});
