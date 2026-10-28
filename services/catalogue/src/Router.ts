import { ApiErrors } from './ApiErrors.js';
import { Cors } from './Cors.js';
import type { Env } from './Env.js';
import { HealthHandler } from './HealthHandler.js';
import { D1ExerciseRepository } from './exercises/D1ExerciseRepository.js';
import { ExerciseHandlers } from './exercises/ExerciseHandlers.js';

/**
 * Routes incoming Worker requests to the matching handler.
 *
 * Owns the dependency graph for a single request lifecycle: parses the
 * CORS allow list from env, constructs the repository and the exercise
 * handler class on initialisation, and holds them for the life of the
 * Worker instance.
 */
export class Router {
  private static readonly DETAIL_PATH = /^\/exercises\/([^/]+)$/;

  private readonly handlers: ExerciseHandlers;
  private readonly allowedOrigins: readonly string[];

  public constructor(env: Env) {
    this.allowedOrigins = Cors.parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const repo = new D1ExerciseRepository(env.DB);
    this.handlers = new ExerciseHandlers(repo);
  }

  /**
   * Route a Worker request to the matching handler. Supports:
   *
   * - `OPTIONS *`: CORS preflight, no body.
   * - `GET /health`: a static ok response, no D1.
   * - `GET /exercises`: list with filters, paging, cache headers.
   * - `GET /exercises/:slug`: detail by slug.
   *
   * Any other method on a known path returns 405. Any other path returns
   * 404. All non-preflight responses have CORS headers added if the
   * request's Origin is on the allow list.
   */
  public async route(request: Request): Promise<Response> {
    const method = request.method.toUpperCase();

    if (method === 'OPTIONS') {
      return Cors.preflightResponse(request, this.allowedOrigins);
    }

    const response = await this.dispatch(request, method);
    return Cors.withCorsHeaders(response, request, this.allowedOrigins);
  }

  private async dispatch(request: Request, method: string): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      if (method !== 'GET') return ApiErrors.methodNotAllowed();
      return HealthHandler.handle();
    }

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
