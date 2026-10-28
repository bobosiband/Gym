import { ApiErrors } from './ApiErrors.js';
import type { Env } from './Env.js';
import { D1ExerciseRepository } from './exercises/D1ExerciseRepository.js';
import { ExerciseHandlers } from './exercises/ExerciseHandlers.js';

/**
 * Routes incoming Worker requests to the matching handler.
 *
 * Owns the dependency graph for a single request lifecycle: constructs
 * the repository and the handler class on initialisation and holds them
 * for the life of the Worker instance.
 */
export class Router {
  private static readonly DETAIL_PATH = /^\/exercises\/([^/]+)$/;

  private readonly handlers: ExerciseHandlers;

  public constructor(env: Env) {
    const repo = new D1ExerciseRepository(env.DB);
    this.handlers = new ExerciseHandlers(repo);
  }

  /**
   * Route a Worker request to the matching handler. Only `GET /exercises`
   * and `GET /exercises/:slug` are supported; anything else yields 404 or
   * 405 depending on whether the path exists for another method.
   */
  public async route(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (url.pathname === '/exercises') {
      if (method !== 'GET') return ApiErrors.methodNotAllowed();
      return this.handlers.handleList(request);
    }

    const detailMatch = url.pathname.match(Router.DETAIL_PATH);
    if (detailMatch !== null) {
      if (method !== 'GET') return ApiErrors.methodNotAllowed();
      const slug = detailMatch[1];
      if (slug === undefined) return ApiErrors.notFound('route not found');
      return this.handlers.handleDetail(slug);
    }

    return ApiErrors.notFound('route not found');
  }
}
