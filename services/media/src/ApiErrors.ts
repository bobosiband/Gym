import type { MediaApi } from '@gym/contracts';

import { JsonResponder } from './JsonResponder.js';

/**
 * Factory of standard error responses used by the media API. Bodies
 * conform to `MediaApi.MediaApiError`. Stateless; use via static
 * methods.
 */
export class ApiErrors {
  private constructor() {
    // utility class; never instantiated
  }

  public static badRequest(message: string): Response {
    const body: MediaApi.MediaApiError = { code: 'BAD_REQUEST', message };
    return JsonResponder.respond(400, body);
  }

  public static notFound(message: string): Response {
    const body: MediaApi.MediaApiError = { code: 'NOT_FOUND', message };
    return JsonResponder.respond(404, body);
  }

  public static methodNotAllowed(): Response {
    const body: MediaApi.MediaApiError = {
      code: 'METHOD_NOT_ALLOWED',
      message: 'method not allowed',
    };
    return JsonResponder.respond(405, body);
  }

  public static internalServerError(message: string): Response {
    const body: MediaApi.MediaApiError = { code: 'INTERNAL', message };
    return JsonResponder.respond(500, body);
  }
}
