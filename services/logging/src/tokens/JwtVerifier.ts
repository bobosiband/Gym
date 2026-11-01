/**
 * The minimum access-token claims the logging service relies on.
 *
 * The subject (`sub`) is the authoritative user identifier, the
 * same string every consumer treats as the user id throughout the
 * system; logging never queries the auth database.
 */
export interface AccessTokenClaims {
  readonly iss: string;
  readonly aud: string;
  readonly sub: string;
  readonly iat: number;
  readonly exp: number;
}

/**
 * JWT-verification boundary. Kept behind an interface so tests
 * can inject a `FakeJwtVerifier` that returns a deterministic
 * subject without network or crypto.
 */
export interface JwtVerifier {
  /**
   * Verify an ES256 access token issued by `services/auth` and
   * return its narrow claim set. Throws on signature mismatch,
   * wrong issuer, wrong audience, unsupported algorithm, or
   * expiry.
   */
  verify(token: string): Promise<AccessTokenClaims>;
}
