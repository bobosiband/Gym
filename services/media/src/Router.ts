import { ApiErrors } from './ApiErrors.js';
import { Cors } from './Cors.js';
import type { Env } from './Env.js';
import { HealthHandler } from './HealthHandler.js';
import { MediaHandler } from './media/MediaHandler.js';
import { R2MediaRepository } from './media/R2MediaRepository.js';

/**
 * Default cache lifetime served when `MAX_AGE_SECONDS` is unset.
 * Media is immutable once uploaded, so a week-long browser cache is
 * safe. The default is a fallback: production always sets the env
 * var via `wrangler.toml`.
 */
const DEFAULT_MAX_AGE_SECONDS = 604_800;

/**
 * Routes incoming Worker requests to the matching handler.
 *
 * Owns the dependency graph for a single request lifecycle: builds
 * the repository and handler from the env bindings, parses the CORS
 * allow list, and dispatches by method and path.
 */
export class Router {
  private readonly handler: MediaHandler;
  private readonly allowedOrigins: readonly string[];

  public constructor(env: Env) {
    this.allowedOrigins = Cors.parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const maxAge = Router.parseMaxAge(env.MAX_AGE_SECONDS);
    const repo = new R2MediaRepository(env.MEDIA);
    this.handler = new MediaHandler(repo, maxAge);
  }

  /**
   * Route a Worker request. Supports:
   *
   *  - `OPTIONS *`: CORS preflight, no body.
   *  - `GET /health`: static liveness probe, no R2 read.
   *  - `GET /media/<key>`: stream the object with cache headers.
   *  - `HEAD /media/<key>`: metadata without the body.
   *
   * Any other method on a known path returns 405. Any other path
   * returns 404. All non-preflight responses have CORS headers added
   * when the request's Origin is on the allow list.
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
      if (method !== 'GET') {
        return ApiErrors.methodNotAllowed();
      }
      return HealthHandler.handle();
    }
    if (url.pathname.startsWith('/media/')) {
      if (method === 'GET') {
        return this.handler.handleGet(request);
      }
      if (method === 'HEAD') {
        return this.handler.handleHead(request);
      }
      return ApiErrors.methodNotAllowed();
    }
    return ApiErrors.notFound('route not found');
  }

  private static parseMaxAge(raw: string | undefined): number {
    if (raw === undefined) {
      return DEFAULT_MAX_AGE_SECONDS;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return DEFAULT_MAX_AGE_SECONDS;
    }
    return parsed;
  }
}
