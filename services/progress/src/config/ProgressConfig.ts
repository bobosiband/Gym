/**
 * Runtime configuration loaded at cold start from SSM.
 *
 * `jwksUrl`, `jwtIssuer`, `jwtAudience` mirror the parameters
 * published by `services/auth` at `/gym/auth/public/*` so the
 * progress service verifies tokens against the same JWKS as every
 * other service.
 *
 * `allowedOrigins` is a parsed list used by {@link Cors}; set to
 * `['*']` to allow any origin per the owner's 2026-10-29 policy
 * update.
 */
export interface ProgressConfig {
  readonly jwksUrl: string;
  readonly jwtIssuer: string;
  readonly jwtAudience: string;
  readonly allowedOrigins: readonly string[];
}
