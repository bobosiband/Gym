import type { AccessTokenClaims } from './TokenPayloads.js';

/**
 * Signer boundary for access tokens.
 *
 * The only implementation is `JoseJwtSigner`, which wraps `jose`.
 * Having an interface keeps `AuthService` unit-testable without
 * writing cryptography in the test environment, and matches the
 * project rule that services never implement their own crypto.
 */
export interface JwtSigner {
  /** Sign an ES256 JWT with the given claims and return the compact string. */
  sign(claims: AccessTokenClaims): Promise<string>;

  /**
   * Verify an ES256 JWT and return its decoded claims. Verification
   * must enforce issuer, audience, subject presence, and expiry; the
   * API Gateway JWT authorizer handles routing, so verifying inside
   * the service is only used for the `GET /auth/me` fallback and for
   * tests.
   */
  verify(
    token: string,
    expectedIssuer: string,
    expectedAudience: string
  ): Promise<AccessTokenClaims>;
}
