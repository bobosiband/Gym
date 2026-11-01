import type { ProgressApi } from '@gym/contracts';
import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ApiResponder } from './ApiResponder.js';

/**
 * Factory of standard error responses. Bodies conform to
 * `ProgressApi.ProgressApiError`.
 */
export class ApiErrors {
  private constructor() {
    // utility class; never instantiated
  }

  public static badRequest(message: string): APIGatewayProxyStructuredResultV2 {
    return ApiErrors.respond(400, 'BAD_REQUEST', message);
  }

  public static unauthorized(message: string): APIGatewayProxyStructuredResultV2 {
    return ApiErrors.respond(401, 'UNAUTHORIZED', message);
  }

  public static notFound(message: string): APIGatewayProxyStructuredResultV2 {
    return ApiErrors.respond(404, 'NOT_FOUND', message);
  }

  public static methodNotAllowed(): APIGatewayProxyStructuredResultV2 {
    return ApiErrors.respond(405, 'METHOD_NOT_ALLOWED', 'method not allowed');
  }

  public static conflict(message: string): APIGatewayProxyStructuredResultV2 {
    return ApiErrors.respond(409, 'CONFLICT', message);
  }

  public static payloadTooLarge(): APIGatewayProxyStructuredResultV2 {
    return ApiErrors.respond(413, 'PAYLOAD_TOO_LARGE', 'payload too large');
  }

  public static internal(): APIGatewayProxyStructuredResultV2 {
    return ApiErrors.respond(500, 'INTERNAL', 'internal error');
  }

  private static respond(
    status: number,
    code: ProgressApi.ProgressApiError['code'],
    message: string
  ): APIGatewayProxyStructuredResultV2 {
    const body: ProgressApi.ProgressApiError = { code, message };
    return ApiResponder.respond(status, body);
  }
}
