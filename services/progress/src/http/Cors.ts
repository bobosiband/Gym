import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

const MAX_AGE_SECONDS = 600;

/**
 * CORS helper matching the catalogue/logging implementations. Keeps
 * cross-origin behaviour consistent across every Gym service.
 */
export class Cors {
  private constructor() {
    // utility class; never instantiated
  }

  public static preflightResponse(
    event: APIGatewayProxyEventV2,
    allowedOrigins: readonly string[]
  ): APIGatewayProxyStructuredResultV2 {
    const origin = Cors.readOrigin(event);
    if (allowedOrigins.length === 1 && allowedOrigins[0] === '*') {
      return {
        statusCode: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
          'access-control-allow-headers': 'content-type, authorization',
          'access-control-max-age': String(MAX_AGE_SECONDS),
        },
      };
    }
    if (origin === null || !allowedOrigins.includes(origin)) {
      return { statusCode: 204 };
    }
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
        'access-control-allow-headers': 'content-type, authorization',
        'access-control-max-age': String(MAX_AGE_SECONDS),
        vary: 'Origin',
      },
    };
  }

  public static withCorsHeaders(
    response: APIGatewayProxyStructuredResultV2,
    event: APIGatewayProxyEventV2,
    allowedOrigins: readonly string[]
  ): APIGatewayProxyStructuredResultV2 {
    const origin = Cors.readOrigin(event);
    const headers = { ...(response.headers ?? {}) };
    if (allowedOrigins.length === 1 && allowedOrigins[0] === '*') {
      headers['access-control-allow-origin'] = '*';
      return { ...response, headers };
    }
    if (origin === null || !allowedOrigins.includes(origin)) {
      return response;
    }
    headers['access-control-allow-origin'] = origin;
    const existingVary = headers['vary'];
    headers['vary'] = existingVary === undefined ? 'Origin' : `${existingVary}, Origin`;
    return { ...response, headers };
  }

  private static readOrigin(event: APIGatewayProxyEventV2): string | null {
    const headers = event.headers ?? {};
    for (const [name, value] of Object.entries(headers)) {
      if (name.toLowerCase() === 'origin' && typeof value === 'string') {
        return value;
      }
    }
    return null;
  }
}
