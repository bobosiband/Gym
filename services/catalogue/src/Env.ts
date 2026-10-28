/**
 * Worker runtime bindings for the catalogue service.
 *
 * Populated by `wrangler.toml` at deploy time. See `wrangler.toml` for the
 * current state of the D1 binding (not yet provisioned, zero cost rule).
 */
export interface Env {
  readonly DB: D1Database;
  readonly ALLOWED_ORIGINS?: string;
}
