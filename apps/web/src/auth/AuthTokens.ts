/**
 * The pair of opaque strings returned by {@link AuthApiClient.login}
 * and {@link AuthApiClient.refresh}. The access token is a short-lived
 * ES256 JWT; the refresh token is an opaque rotating credential.
 *
 * Both strings must be treated as sensitive and must never be logged.
 */
export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresInSeconds: number;
}
