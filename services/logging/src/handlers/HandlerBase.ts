import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import type { ZodType } from 'zod';

import { ApiErrors } from '../http/ApiErrors.js';
import { BodyParser, type ParseResult } from '../http/BodyParser.js';
import { LoggingServiceError } from '../service/LoggingServiceErrors.js';
import { Logger } from '../util/Logger.js';

/**
 * Shared pieces every logging handler reuses: Bearer-token
 * extraction, body parsing, error-code mapping, and a structured
 * logger. Kept as static helpers rather than inheritance to keep
 * each handler file independent and small.
 */
export class HandlerBase {
  private static readonly IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9_-]{8,64}$/;

  private constructor() {
    // utility class; never instantiated
  }

  public static buildLogger(service: string, event: APIGatewayProxyEventV2): Logger {
    const requestId = event.requestContext.requestId;
    return new Logger(service, requestId);
  }

  public static readBearerToken(event: APIGatewayProxyEventV2): string | null {
    const headers = event.headers ?? {};
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'authorization') {
        const value = headers[key];
        if (typeof value !== 'string') return null;
        const match = value.match(/^Bearer\s+(.+)$/i);
        return match === null ? null : (match[1] ?? null);
      }
    }
    return null;
  }

  /**
   * Return the `Idempotency-Key` header value if present and
   * well-formed, otherwise `null`. Returns the sentinel
   * `'invalid'` when the header is present but malformed so the
   * caller can respond with 400 instead of silently ignoring it.
   */
  public static readIdempotencyKey(
    event: APIGatewayProxyEventV2
  ): { kind: 'present'; value: string } | { kind: 'absent' } | { kind: 'invalid' } {
    const headers = event.headers ?? {};
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'idempotency-key') {
        const value = headers[key];
        if (typeof value !== 'string' || value.length === 0) return { kind: 'invalid' };
        if (!HandlerBase.IDEMPOTENCY_KEY_REGEX.test(value)) return { kind: 'invalid' };
        return { kind: 'present', value };
      }
    }
    return { kind: 'absent' };
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
   * Map a `LoggingServiceError` to the correct HTTP response.
   */
  public static mapLoggingError(err: LoggingServiceError): APIGatewayProxyStructuredResultV2 {
    switch (err.code) {
      case 'NOT_FOUND':
        return ApiErrors.notFound('workout not found');
      case 'FORBIDDEN':
        return ApiErrors.forbidden('forbidden');
      case 'IDEMPOTENCY_IN_PROGRESS':
        return ApiErrors.conflict('idempotent retry still in progress');
      case 'EVENT_PUBLISH_FAILED':
        return ApiErrors.serviceUnavailable('event publish failed; retry later');
      default:
        return ApiErrors.internal();
    }
  }
}
