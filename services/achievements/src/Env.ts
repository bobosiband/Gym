/**
 * Worker runtime bindings for the achievements service.
 *
 * Populated by `wrangler.toml` at deploy time and by `wrangler secret
 * put INTERNAL_EVENTS_KEY` for the shared webhook secret.
 */
export interface Env {
  readonly DB: D1Database;
  readonly ALLOWED_ORIGINS?: string;
  readonly INTERNAL_EVENTS_KEY: string;
  readonly JWT_ISSUER: string;
  readonly JWT_AUDIENCE: string;
  readonly JWKS_URL: string;
}
