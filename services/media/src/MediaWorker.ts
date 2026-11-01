import { ApiErrors } from './ApiErrors.js';
import type { Env } from './Env.js';
import { Router } from './Router.js';

/**
 * Cloudflare Worker entry for the media service.
 *
 * Instantiated once per Worker isolate; the default export in
 * `index.ts` is a singleton of this class. Each `fetch` call builds a
 * fresh {@link Router} so per-request state is never shared.
 */
export class MediaWorker {
  public async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    try {
      const router = new Router(env);
      return await router.route(request);
    } catch (err) {
      console.error('media: unhandled error', err);
      return ApiErrors.internalServerError('internal error');
    }
  }
}
