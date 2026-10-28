import type { CatalogueApi } from '@gym/contracts';

import { ApiErrors } from '../ApiErrors.js';
import { JsonResponder } from '../JsonResponder.js';
import type { ExerciseRepository } from './ExerciseRepository.js';
import { ListParamsParser } from './ListParamsParser.js';
import { SlugValidator } from './SlugValidator.js';
import { ValidationError } from './ValidationError.js';

/**
 * HTTP handlers for the `/exercises` resource.
 *
 * Depends on `ExerciseRepository` via constructor injection; no handler
 * creates a repository directly, which keeps the class unit-testable.
 */
export class ExerciseHandlers {
  public constructor(private readonly repo: ExerciseRepository) {}

  /**
   * Handle `GET /exercises`. Supports `muscle`, `equipment`, `limit`,
   * `offset` query parameters. Returns `ExerciseListResponse` on success.
   */
  public async handleList(request: Request): Promise<Response> {
    const url = new URL(request.url);
    let params;
    try {
      params = ListParamsParser.parse(url);
    } catch (err) {
      if (err instanceof ValidationError) {
        return ApiErrors.badRequest(err.message);
      }
      throw err;
    }
    const [exercises, total] = await Promise.all([
      this.repo.listExercises(params),
      this.repo.countExercises(params),
    ]);
    const body: CatalogueApi.ExerciseListResponse = { exercises, total };
    return JsonResponder.respond(200, body);
  }

  /**
   * Handle `GET /exercises/:slug`. Returns `ExerciseDetailResponse` on
   * success, `ApiError` with `BAD_REQUEST` for an invalid slug, or
   * `ApiError` with `NOT_FOUND` when no row matches.
   */
  public async handleDetail(slug: string): Promise<Response> {
    if (!SlugValidator.isValid(slug)) {
      return ApiErrors.badRequest('slug must be lowercase kebab-case');
    }
    const exercise = await this.repo.getExerciseBySlug(slug);
    if (exercise === null) {
      return ApiErrors.notFound(`exercise not found: ${slug}`);
    }
    const body: CatalogueApi.ExerciseDetailResponse = { exercise };
    return JsonResponder.respond(200, body);
  }
}
