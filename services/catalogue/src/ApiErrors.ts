import type { CatalogueApi } from '@gym/contracts';

import { JsonResponder } from './JsonResponder.js';

/**
 * Factory of standard error responses used by the catalogue API.
 *
 * Response bodies conform to `CatalogueApi.ApiError`. Stateless; use via
 * static methods.
 */
export class ApiErrors {
  private constructor() {
    // utility class; never instantiated
  }

  /**
   * Build a 400 Bad Request response.
   */
  public static badRequest(message: string): Response {
    const body: CatalogueApi.ApiError = { code: 'BAD_REQUEST', message };
    return JsonResponder.respond(400, body);
  }

  /**
   * Build a 404 Not Found response.
   */
  public static notFound(message: string): Response {
    const body: CatalogueApi.ApiError = { code: 'NOT_FOUND', message };
    return JsonResponder.respond(404, body);
  }

  /**
   * Build a 405 Method Not Allowed response.
   */
  public static methodNotAllowed(): Response {
    const body: CatalogueApi.ApiError = {
      code: 'METHOD_NOT_ALLOWED',
      message: 'method not allowed',
    };
    return JsonResponder.respond(405, body);
  }

  /**
   * Build a 500 Internal Server Error response.
   */
  public static internalServerError(message: string): Response {
    const body: CatalogueApi.ApiError = { code: 'INTERNAL', message };
    return JsonResponder.respond(500, body);
  }
}
