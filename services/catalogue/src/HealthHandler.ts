import type { CatalogueApi } from '@gym/contracts';

import { JsonResponder } from './JsonResponder.js';

/**
 * Health probe for `GET /health`.
 *
 * Returns a static `{ status: "ok" }` and does not touch D1 or any other
 * binding, so platform health checks never depend on the DB being up.
 * Stateless; use via static methods.
 */
export class HealthHandler {
  private constructor() {
    // utility class; never instantiated
  }

  public static handle(): Response {
    const body: CatalogueApi.HealthResponse = { status: 'ok' };
    return JsonResponder.respond(200, body);
  }
}
