import type { Env } from './env.js';
import { methodNotAllowed, notFound } from './errors.js';
import { handleGetExerciseBySlug, handleListExercises } from './exercises/handlers.js';
import { D1ExerciseRepository } from './exercises/repository.js';

const DETAIL_PATH = /^\/exercises\/([^/]+)$/;

/**
 * Route a Worker request to the matching handler. Only `GET /exercises`
 * and `GET /exercises/:slug` are supported; anything else yields a 404 or
 * a 405 depending on whether the path exists for another method.
 */
export async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const repo = new D1ExerciseRepository(env.DB);

  if (url.pathname === '/exercises') {
    if (method !== 'GET') return methodNotAllowed();
    return handleListExercises(request, repo);
  }

  const detailMatch = url.pathname.match(DETAIL_PATH);
  if (detailMatch !== null) {
    if (method !== 'GET') return methodNotAllowed();
    const slug = detailMatch[1];
    if (slug === undefined) return notFound('route not found');
    return handleGetExerciseBySlug(slug, repo);
  }

  return notFound('route not found');
}
