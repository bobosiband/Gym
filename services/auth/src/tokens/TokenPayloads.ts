/**
 * Access-token claims. Only standard JWT claims appear here so other
 * services can verify tokens by checking issuer, audience, subject,
 * and expiry without pulling in any `services/auth` type.
 *
 * - `iss` is the auth service issuer URL.
 * - `aud` is the Gym API audience value shared by every API Gateway.
 * - `sub` is the user id.
 * - `iat` and `exp` are seconds since the Unix epoch, as per RFC 7519.
 */
export interface AccessTokenClaims {
  readonly iss: string;
  readonly aud: string;
  readonly sub: string;
  readonly iat: number;
  readonly exp: number;
}
