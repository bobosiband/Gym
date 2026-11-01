import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import type { AccessTokenClaims, JwtVerifier } from './JwtVerifier.js';

/**
 * `JwtVerifier` that verifies ES256 access tokens against a remote
 * JWKS endpoint published by `services/auth`. Mirrors the
 * implementation in `services/logging` so there is one authoritative
 * verification pattern across the project.
 */
export class JwksJwtVerifier implements JwtVerifier {
  private static readonly ALGORITHM = 'ES256';
  private static readonly JWKS_CACHE_MS = 600_000;
  private static readonly JWKS_COOLDOWN_MS = 30_000;

  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  public constructor(
    jwksUrl: string,
    private readonly issuer: string,
    private readonly audience: string
  ) {
    this.jwks = createRemoteJWKSet(new URL(jwksUrl), {
      cacheMaxAge: JwksJwtVerifier.JWKS_CACHE_MS,
      cooldownDuration: JwksJwtVerifier.JWKS_COOLDOWN_MS,
    });
  }

  public async verify(token: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.issuer,
      audience: this.audience,
      algorithms: [JwksJwtVerifier.ALGORITHM],
    });
    return JwksJwtVerifier.narrowClaims(payload);
  }

  private static narrowClaims(payload: JWTPayload): AccessTokenClaims {
    const { iss, aud, sub, iat, exp } = payload;
    if (
      typeof iss !== 'string' ||
      typeof aud !== 'string' ||
      typeof sub !== 'string' ||
      typeof iat !== 'number' ||
      typeof exp !== 'number'
    ) {
      throw new Error('invalid access token claims');
    }
    return { iss, aud, sub, iat, exp };
  }
}
