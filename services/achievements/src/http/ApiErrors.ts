import type { AchievementsApi } from '@gym/contracts';

import { JsonResponder } from './JsonResponder.js';

/**
 * Centralised HTTP error responses. All error bodies follow
 * `AchievementsApi.achievementsApiErrorSchema`.
 */
export class ApiErrors {
  private constructor() {
    // utility class; never instantiated
  }

  private static error(
    status: number,
    code: AchievementsApi.AchievementsApiError['code'],
    message: string
  ): Response {
    const body: AchievementsApi.AchievementsApiError = { code, message };
    return JsonResponder.respond(status, body);
  }

  public static badRequest(message: string): Response {
    return ApiErrors.error(400, 'BAD_REQUEST', message);
  }

  public static unauthorized(message: string = 'invalid credentials'): Response {
    return ApiErrors.error(401, 'UNAUTHORIZED', message);
  }

  public static forbidden(message: string = 'forbidden'): Response {
    return ApiErrors.error(403, 'FORBIDDEN', message);
  }

  public static notFound(message: string = 'not found'): Response {
    return ApiErrors.error(404, 'NOT_FOUND', message);
  }

  public static methodNotAllowed(): Response {
    return ApiErrors.error(405, 'METHOD_NOT_ALLOWED', 'method not allowed');
  }

  public static internalServerError(message: string = 'internal error'): Response {
    return ApiErrors.error(500, 'INTERNAL', message);
  }
}
