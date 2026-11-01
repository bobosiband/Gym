/**
 * Resolved runtime config for the logging service.
 *
 * All values are read from AWS Systems Manager Parameter Store at
 * cold start. The `issuer`, `audience`, and `jwksUrl` are
 * published by `services/auth` under `/gym/auth/public/*` and are
 * stable across deploys of the logging service. `allowedOrigins`
 * is published by the logging service's own setup script under
 * `/gym/logging/app/origins` and may contain the wildcard string
 * `['*']` (per CLAUDE.md 15).
 */
export interface LoggingConfig {
  readonly issuer: string;
  readonly audience: string;
  readonly jwksUrl: string;
  readonly allowedOrigins: readonly string[];
}
