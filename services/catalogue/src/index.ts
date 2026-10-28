import type { Env } from './env.js';
import { internalServerError } from './errors.js';
import { route } from './router.js';

/**
 * Cloudflare Worker entry for the exercise catalogue service.
 *
 * Dispatches to `route()`. Any uncaught error becomes a 500; the error is
 * logged to the Worker log for Cloudflare dashboard inspection.
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    try {
      return await route(request, env);
    } catch (err) {
      console.error('catalogue: unhandled error', err);
      return internalServerError('internal error');
    }
  },
};
