/**
 * Catalogue API contract (v1).
 *
 * HTTP shape for `services/catalogue`. Any change to the types in this file
 * is a breaking change and requires owner approval before merging. Bump the
 * version in the filename (e.g. catalogue.v2.ts) if you need to introduce a
 * breaking schema. See docs/events.md for the versioning rule.
 */

/**
 * A single exercise record returned by the catalogue.
 */
export interface Exercise {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly muscles: readonly string[];
  readonly equipment: readonly string[];
  readonly instructions: string;
  readonly createdAt: string;
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
 * Standard error body for all 4xx and 5xx responses from the catalogue.
 */
export interface ApiError {
  readonly code: 'BAD_REQUEST' | 'NOT_FOUND' | 'METHOD_NOT_ALLOWED' | 'INTERNAL';
  readonly message: string;
}
