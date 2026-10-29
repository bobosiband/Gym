import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

/**
 * CORS helpers.
 *
 * The allow list is loaded from the `ALLOWED_ORIGINS` env var at cold
 * start and passed in explicitly on every call, which keeps this class
 * stateless and testable. There is no wildcard: the request Origin is
 * echoed back only if it exactly matches an entry. Preflight responses
 * are built here directly; non-preflight responses are decorated by
 * `withCorsHeaders` after the handler returns.
 */
export class Cors {
  private static readonly ALLOWED_METHODS = 'GET, POST, OPTIONS';
  private static readonly ALLOWED_HEADERS = 'content-type, authorization';

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
    const origin = Cors.getRequestOrigin(event);
    if (origin === null || !allowedOrigins.includes(origin)) return response;
    const merged = {
      ...(response.headers ?? {}),
      'access-control-allow-origin': origin,
      vary: 'Origin',
    };
    return { ...response, headers: merged };
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
