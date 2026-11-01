import type { MediaApi } from '@gym/contracts';

import { JsonResponder } from './JsonResponder.js';

/**
 * `GET /health` handler. Reads no bindings so uptime checks keep
 * working during an R2 outage. Mirrors the pattern used by the auth,
 * catalogue and logging health probes.
 */
export class HealthHandler {
  private constructor() {
    // utility class; never instantiated
  }

  public static handle(): Response {
    const body: MediaApi.HealthResponse = { status: 'ok' };
    return JsonResponder.respond(200, body);
  }
}
