import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import type { ZodType } from 'zod';

import { ApiErrors } from '../http/ApiErrors.js';
import { BodyParser, type ParseResult } from '../http/BodyParser.js';
import { AuthServiceError } from '../service/AuthServiceErrors.js';
import { Logger } from '../util/Logger.js';

/**
 * Shared pieces every POST handler reuses: body parsing, error-code
 * mapping, and a structured logger. Kept as static helpers rather
 * than inheritance to keep each handler file independent and small.
 */
export class HandlerBase {
  private constructor() {
    // utility class; never instantiated
  }

  public static buildLogger(service: string, event: APIGatewayProxyEventV2): Logger {
    const requestId = event.requestContext.requestId;
    return new Logger(service, requestId);
  }

  public static parseBodyOrFail<T>(
    event: APIGatewayProxyEventV2,
    schema: ZodType<T>
  ): { ok: true; value: T } | { ok: false; response: APIGatewayProxyStructuredResultV2 } {
    const parsed: ParseResult<T> = BodyParser.parse(event, schema);
    if (parsed.ok) return { ok: true, value: parsed.value };
    if (parsed.reason === 'too_large') return { ok: false, response: ApiErrors.payloadTooLarge() };
    return { ok: false, response: ApiErrors.badRequest(parsed.message) };
  }

  /**
   * Map an `AuthServiceError` to the correct HTTP response. The
   * responses here all carry generic messages so an attacker cannot
   * distinguish, say, "no such user" from "wrong password".
   */
  public static mapAuthError(err: AuthServiceError): APIGatewayProxyStructuredResultV2 {
    switch (err.code) {
      case 'INVALID_CREDENTIALS':
        return ApiErrors.unauthorized('invalid credentials');
      case 'ACCOUNT_LOCKED':
        return ApiErrors.unauthorized('invalid credentials');
      case 'EMAIL_NOT_VERIFIED':
        return ApiErrors.forbidden('email not verified');
      case 'INVALID_TOKEN':
        return ApiErrors.badRequest('invalid or expired token');
      case 'TOKEN_EXPIRED':
        return ApiErrors.badRequest('invalid or expired token');
      case 'TOKEN_ALREADY_USED':
        return ApiErrors.unauthorized('invalid credentials');
      case 'WEAK_PASSWORD':
        return ApiErrors.badRequest('password must be between 12 and 128 characters');
      case 'EMAIL_RATE_LIMITED':
        return ApiErrors.tooManyRequests('too many requests for this email');
      default:
        return ApiErrors.internal();
    }
  }
}
