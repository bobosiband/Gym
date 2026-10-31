import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import type { AccessTokenClaims, JwtVerifier } from './JwtVerifier.js';

/**
 * `JwtVerifier` that verifies ES256 access tokens against a remote
 * JWKS endpoint, published by `services/auth` at
 * `/.well-known/jwks.json`. The JWKS is cached for ten minutes
 * across warm invocations by `jose`'s own cache; a signature
 * failure triggers a refresh (`cooldownDuration` controls the
 * minimum interval between forced refreshes).
 *
 * The verifier accepts only `ES256`; passing a token signed with
 * another algorithm throws. The expected issuer and audience are
 * fixed at construction time; both come from SSM at cold start.
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
