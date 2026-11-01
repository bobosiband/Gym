import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import type { ZodSchema } from 'zod';

import { ApiErrors } from '../http/ApiErrors.js';
import { ProgressServiceError } from '../progress/ProgressServiceErrors.js';

const MAX_BODY_BYTES = 4 * 1024;

/**
 * Shared helpers used by every HTTP handler. Mirrors the shape of
 * `services/logging/src/handlers/HandlerBase.ts` so handlers in the
 * two services read as near copies and reviewers can scan for
 * divergence quickly.
 */
export class HandlerBase {
  private constructor() {
    // utility class; never instantiated
  }

  /** Pull the Bearer token out of an Authorization header. */
  public static readBearerToken(event: APIGatewayProxyEventV2): string | null {
    const headers = event.headers ?? {};
    for (const [name, value] of Object.entries(headers)) {
      if (name.toLowerCase() === 'authorization' && typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.toLowerCase().startsWith('bearer ')) {
          return trimmed.slice(7).trim();
        }
      }
    }
    return null;
  }

  /**
   * Validate a JSON body against the given Zod schema. Enforces a
   * {@link MAX_BODY_BYTES} payload cap before parsing to protect
   * against a hostile Zod recursion attack.
   */
  public static parseBodyOrFail<T>(
    event: APIGatewayProxyEventV2,
    schema: ZodSchema<T>
  ): { ok: true; value: T } | { ok: false; response: APIGatewayProxyStructuredResultV2 } {
    const raw = event.body;
    if (raw === undefined || raw === null || raw.length === 0) {
      return { ok: false, response: ApiErrors.badRequest('request body required') };
    }
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
      return { ok: false, response: ApiErrors.payloadTooLarge() };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, response: ApiErrors.badRequest('invalid JSON') };
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      return {
        ok: false,
        response: ApiErrors.badRequest(result.error.issues[0]?.message ?? 'invalid body'),
      };
    }
    return { ok: true, value: result.data };
  }

  /** Map a {@link ProgressServiceError} to the HTTP response. */
  public static mapServiceError(err: ProgressServiceError): APIGatewayProxyStructuredResultV2 {
    switch (err.code) {
      case 'BAD_REQUEST':
        return ApiErrors.badRequest(err.message);
      case 'INVALID_TIME_ZONE':
        return ApiErrors.badRequest(err.message);
      case 'DAILY_TARGET_ACTIVE':
        return ApiErrors.conflict(err.message);
      case 'NOT_FOUND':
        return ApiErrors.notFound(err.message);
      case 'EVENT_PUBLISH_FAILED':
        return ApiErrors.internal();
      default:
        return ApiErrors.internal();
    }
  }
}
