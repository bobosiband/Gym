/**
 * Minimal JWT verification surface. The Worker depends on this
 * interface; the production driver wraps `jose`'s remote JWKS with
 * a 10-minute cache, and tests swap in a deterministic stub.
 */
export interface VerifiedClaims {
  readonly sub: string;
}

export interface JwtVerifier {
  verify(token: string): Promise<VerifiedClaims>;
}
