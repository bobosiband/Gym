import type { Env } from './Env.js';
import { ApiErrors } from './http/ApiErrors.js';
import { Router } from './Router.js';

/**
 * Cloudflare Worker entry for the achievements service.
 *
 * Instantiated once per Worker isolate; the default export in
 * `index.ts` is a singleton of this class. Each `fetch` builds a
 * fresh {@link Router} so per-request state never leaks.
 */
export class AchievementsWorker {
  public async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    try {
      const router = new Router(env);
      return await router.route(request);
    } catch (err) {
      console.error('achievements: unhandled error', err);
      return ApiErrors.internalServerError();
    }
  }
}
