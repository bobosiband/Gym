/**
 * Catalogue API contract (v1).
 *
 * HTTP shape for `services/catalogue`. Any change to the types in this file
 * is a breaking change and requires owner approval before merging. Bump the
 * version in the filename (e.g. catalogue.v2.ts) if you need to introduce a
 * breaking schema. See docs/events.md for the versioning rule.
 *
 * Change note: `licence`, `author`, and `sourceUrl` were added to Exercise
 * in place on 2026-10-29 with owner approval, since no deployed consumer
 * existed. Future breaking changes must bump the filename version.
 */

/**
 * A single exercise record returned by the catalogue.
 *
 * `licence`, `author`, and `sourceUrl` carry the attribution required by
 * the upstream data source. Clients that redisplay or redistribute this
 * content must preserve those fields.
 */
export interface Exercise {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly muscles: readonly string[];
  readonly equipment: readonly string[];
  readonly instructions: string;
  readonly createdAt: string;
  readonly licence: string;
  readonly author: string;
  readonly sourceUrl: string;
}

/**
 * Query parameters accepted by `GET /exercises`.
 * All fields are optional.
 */
export interface ExerciseListQuery {
  readonly muscle?: string;
  readonly equipment?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Response body for `GET /exercises`.
 */
export interface ExerciseListResponse {
  readonly exercises: readonly Exercise[];
  readonly total: number;
}

/**
 * Response body for `GET /exercises/:slug`.
 */
export interface ExerciseDetailResponse {
  readonly exercise: Exercise;
}

/**
 * Response body for `GET /health`. Does not touch D1.
 */
export interface HealthResponse {
  readonly status: 'ok';
}

/**
 * Standard error body for all 4xx and 5xx responses from the catalogue.
 */
export interface ApiError {
  readonly code: 'BAD_REQUEST' | 'NOT_FOUND' | 'METHOD_NOT_ALLOWED' | 'INTERNAL';
  readonly message: string;
}
