/**
 * Claims pulled out of a verified access token. The subject (`sub`)
 * is the authenticated user's id and is the only claim the service
 * actually reads today, but the full set is kept for symmetry with
 * `services/auth` and `services/logging`.
 */
export interface AccessTokenClaims {
  readonly iss: string;
  readonly aud: string;
  readonly sub: string;
  readonly iat: number;
  readonly exp: number;
}

/**
 * Boundary for token verification. The production implementation
 * verifies against the auth service's JWKS; tests use a stub that
 * accepts a pre-seeded token.
 */
export interface JwtVerifier {
  verify(token: string): Promise<AccessTokenClaims>;
}
