/**
 * Worker runtime bindings for the media service.
 *
 * Populated by `wrangler.toml` at deploy time:
 *
 *  - `MEDIA` is the R2 bucket binding. The bucket is created out of
 *    band (`wrangler r2 bucket create gym-media`) and holds exercise
 *    GIFs, images and short MP4s uploaded ahead of time.
 *  - `ALLOWED_ORIGINS` is a comma-separated allow list used by
 *    `Cors`. Unset means "no cross-origin access".
 *  - `MAX_AGE_SECONDS` is the shared Cache-Control max-age served
 *    with every successful media response. Media is immutable once
 *    uploaded, so a long value (default one week) is safe.
 */
export interface Env {
  readonly MEDIA: R2Bucket;
  readonly ALLOWED_ORIGINS?: string;
  readonly MAX_AGE_SECONDS?: string;
}
