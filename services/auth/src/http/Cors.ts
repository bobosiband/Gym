import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

/**
 * CORS helpers.
 *
 * The allow list is loaded from the `ALLOWED_ORIGINS` env var at cold
 * start and passed in explicitly on every call, which keeps this class
 * stateless and testable.
 *
 * Wildcard mode: if the allow list is exactly `['*']` (or
 * `APP_ORIGINS` was set to `*`) the service responds with
 * `access-control-allow-origin: *` and omits `vary: Origin`. The
 * project rule previously forbade wildcards; the owner updated
 * `CLAUDE.md` on 2026-10-29 to permit `*` for the auth API during
 * early frontend bring-up.
 *
 * Named-origin mode: the request `Origin` is echoed back only if it
 * exactly matches an entry; preflight otherwise returns 204 with no
 * CORS headers so the browser blocks the follow-up.
 */
export class Cors {
  private static readonly ALLOWED_METHODS = 'GET, POST, OPTIONS';
  private static readonly ALLOWED_HEADERS = 'content-type, authorization';
  private static readonly WILDCARD = '*';

  private constructor() {
    // utility class; never instantiated
  }

  public static parseAllowedOrigins(raw: string | undefined): readonly string[] {
    if (raw === undefined) return [];
    return raw
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
  }

  public static preflightResponse(
    event: APIGatewayProxyEventV2,
    allowedOrigins: readonly string[]
  ): APIGatewayProxyStructuredResultV2 {
    if (Cors.isWildcard(allowedOrigins)) {
      return {
        statusCode: 204,
        headers: {
          'access-control-allow-origin': Cors.WILDCARD,
          'access-control-allow-methods': Cors.ALLOWED_METHODS,
          'access-control-allow-headers': Cors.ALLOWED_HEADERS,
          'access-control-max-age': '600',
        },
      };
    }
    const origin = Cors.getRequestOrigin(event);
    if (origin === null || !allowedOrigins.includes(origin)) {
      return { statusCode: 204, headers: {} };
    }
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': Cors.ALLOWED_METHODS,
        'access-control-allow-headers': Cors.ALLOWED_HEADERS,
        'access-control-max-age': '600',
        vary: 'Origin',
      },
    };
  }

  public static withCorsHeaders(
    response: APIGatewayProxyStructuredResultV2,
    event: APIGatewayProxyEventV2,
    allowedOrigins: readonly string[]
  ): APIGatewayProxyStructuredResultV2 {
    if (Cors.isWildcard(allowedOrigins)) {
      const merged = {
        ...(response.headers ?? {}),
        'access-control-allow-origin': Cors.WILDCARD,
      };
      return { ...response, headers: merged };
    }
    const origin = Cors.getRequestOrigin(event);
    if (origin === null || !allowedOrigins.includes(origin)) return response;
    const merged = {
      ...(response.headers ?? {}),
      'access-control-allow-origin': origin,
      vary: 'Origin',
    };
    return { ...response, headers: merged };
  }

  private static isWildcard(allowedOrigins: readonly string[]): boolean {
    return allowedOrigins.length === 1 && allowedOrigins[0] === Cors.WILDCARD;
  }

  private static getRequestOrigin(event: APIGatewayProxyEventV2): string | null {
    const headers = event.headers ?? {};
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'origin') {
        const value = headers[key];
        return typeof value === 'string' && value.length > 0 ? value : null;
      }
    }
    return null;
  }
}
