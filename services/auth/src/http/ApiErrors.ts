import type { AuthApi } from '@gym/contracts';
import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ApiResponder } from './ApiResponder.js';

/**
 * Factory of standard error responses. Response bodies conform to
 * `AuthApi.AuthApiError`. Error messages are deliberately generic for
 * every authentication-sensitive endpoint so an attacker cannot
 * distinguish "no such email" from "wrong password" by response text.
 * Stateless; use via static methods.
 */
export class ApiErrors {
  private constructor() {
    // utility class; never instantiated
  }

  public static badRequest(message: string): APIGatewayProxyStructuredResultV2 {
    const body: AuthApi.AuthApiError = { code: 'BAD_REQUEST', message };
    return ApiResponder.respond(400, body);
  }

  public static unauthorized(message: string): APIGatewayProxyStructuredResultV2 {
    const body: AuthApi.AuthApiError = { code: 'UNAUTHORIZED', message };
    return ApiResponder.respond(401, body);
  }

  public static forbidden(message: string): APIGatewayProxyStructuredResultV2 {
    const body: AuthApi.AuthApiError = { code: 'FORBIDDEN', message };
    return ApiResponder.respond(403, body);
  }

  public static notFound(message: string): APIGatewayProxyStructuredResultV2 {
    const body: AuthApi.AuthApiError = { code: 'NOT_FOUND', message };
    return ApiResponder.respond(404, body);
  }

  public static methodNotAllowed(): APIGatewayProxyStructuredResultV2 {
    const body: AuthApi.AuthApiError = {
      code: 'METHOD_NOT_ALLOWED',
      message: 'method not allowed',
    };
    return ApiResponder.respond(405, body);
  }

  public static conflict(message: string): APIGatewayProxyStructuredResultV2 {
    const body: AuthApi.AuthApiError = { code: 'CONFLICT', message };
    return ApiResponder.respond(409, body);
  }

  public static tooManyRequests(message: string): APIGatewayProxyStructuredResultV2 {
    const body: AuthApi.AuthApiError = { code: 'TOO_MANY_REQUESTS', message };
    return ApiResponder.respond(429, body);
  }

  public static payloadTooLarge(): APIGatewayProxyStructuredResultV2 {
    const body: AuthApi.AuthApiError = {
      code: 'PAYLOAD_TOO_LARGE',
      message: 'request body too large',
    };
    return ApiResponder.respond(413, body);
  }

  public static internal(): APIGatewayProxyStructuredResultV2 {
    const body: AuthApi.AuthApiError = { code: 'INTERNAL', message: 'internal error' };
    return ApiResponder.respond(500, body);
  }
}
