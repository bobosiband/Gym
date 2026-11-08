import { JsonResponder } from './http/JsonResponder.js';

/**
 * Health probe. Keeps the Worker cold-start minimal: no D1 round
 * trip, just a plain 200 so uptime monitors and smoke scripts have
 * something to hit without creating any state.
 */
export class HealthHandler {
  private constructor() {
    // utility class; never instantiated
  }

  public static handle(): Response {
    return JsonResponder.respond(200, { status: 'ok' });
  }
}
