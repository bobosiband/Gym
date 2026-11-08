import { createRemoteJWKSet, jwtVerify } from 'jose';

import type { JwtVerifier, VerifiedClaims } from './JwtVerifier.js';

/**
 * JWKS-backed verifier. Fetches the signing keys once per Worker
 * isolate and caches them for 10 minutes. Verifies the token's
 * signature, issuer, and audience against the configured values.
 */
export class JwksJwtVerifier implements JwtVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  public constructor(
    jwksUrl: string,
    private readonly issuer: string,
    private readonly audience: string
  ) {
    this.jwks = createRemoteJWKSet(new URL(jwksUrl), { cacheMaxAge: 600_000 });
  }

  public async verify(token: string): Promise<VerifiedClaims> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.issuer,
      audience: this.audience,
    });
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('token missing sub claim');
    }
    return { sub: payload.sub };
  }
}
