/**
 * Media API contract (v1).
 *
 * HTTP shape for `services/media`. Any change to the types in this
 * file is a breaking change and requires owner approval. Bump the
 * version in the filename (for example `media.v2.ts`) for a breaking
 * schema change. See `docs/events.md` for the full versioning rule.
 *
 * The service's primary responses are binary (GIF, JPEG, PNG, WebP,
 * MP4), not JSON, so this file does not define a response type for
 * `GET /media/<key>`. Only the health response and the shared error
 * envelope are JSON.
 */

/**
 * Standard error body for all 4xx and 5xx JSON responses from the
 * media API. Binary routes still fall back to this envelope when the
 * object is missing or the key is invalid.
 */
export interface MediaApiError {
  readonly code:
    'BAD_REQUEST' | 'NOT_FOUND' | 'METHOD_NOT_ALLOWED' | 'PAYLOAD_TOO_LARGE' | 'INTERNAL';
  readonly message: string;
}

/**
 * Response body for `GET /health`. Dependency-free, mirrors the
 * other services' liveness probe shape.
 */
export interface HealthResponse {
  readonly status: 'ok';
}
