import type { CatalogueApi } from '@gym/contracts';

import { badRequest, notFound } from '../errors.js';
import { jsonResponse } from '../json.js';
import { isValidSlug, parseListParams, ValidationError } from './parse.js';
import type { ExerciseRepository } from './repository.js';

/**
 * Handle `GET /exercises`. Supports `muscle`, `equipment`, `limit`, `offset`
 * query parameters. Returns `ExerciseListResponse` on success.
 */
export async function handleListExercises(
  request: Request,
  repo: ExerciseRepository
): Promise<Response> {
  const url = new URL(request.url);
  let params;
  try {
    params = parseListParams(url);
  } catch (err) {
    if (err instanceof ValidationError) {
      return badRequest(err.message);
    }
    throw err;
  }
  const [exercises, total] = await Promise.all([
    repo.listExercises(params),
    repo.countExercises(params),
  ]);
  const body: CatalogueApi.ExerciseListResponse = { exercises, total };
  return jsonResponse(200, body);
}

/**
 * Handle `GET /exercises/:slug`. Returns `ExerciseDetailResponse` on success,
 * `ApiError` with code `BAD_REQUEST` for an invalid slug, or
 * `ApiError` with code `NOT_FOUND` when no row matches.
 */
export async function handleGetExerciseBySlug(
  slug: string,
  repo: ExerciseRepository
): Promise<Response> {
  if (!isValidSlug(slug)) {
    return badRequest('slug must be lowercase kebab-case');
  }
  const exercise = await repo.getExerciseBySlug(slug);
  if (exercise === null) {
    return notFound(`exercise not found: ${slug}`);
  }
  const body: CatalogueApi.ExerciseDetailResponse = { exercise };
  return jsonResponse(200, body);
}
