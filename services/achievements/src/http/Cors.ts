const MAX_AGE_SECONDS = 600;
const ALLOWED_METHODS = 'GET, POST, OPTIONS';
const ALLOWED_HEADERS = 'authorization, content-type, x-internal-events-key';

/**
 * CORS helper. Parses the ALLOWED_ORIGINS env var, answers preflight
 * requests, and tags cross-origin responses with the Access-Control
 * headers. `*` is permitted per the owner's 2026-10-29 policy. Keep
 * the toggle in APP_ORIGINS; never hard-code `*` in source.
 */
export class Cors {
  private constructor() {
    // utility class; never instantiated
  }

  public static parseAllowedOrigins(raw: string | undefined): readonly string[] {
    if (raw === undefined || raw.length === 0) return [];
    return raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  public static preflightResponse(request: Request, allowedOrigins: readonly string[]): Response {
    const headers = new Headers();
    if (Cors.isWildcard(allowedOrigins)) {
      headers.set('access-control-allow-origin', '*');
      headers.set('access-control-allow-methods', ALLOWED_METHODS);
      headers.set('access-control-allow-headers', ALLOWED_HEADERS);
      headers.set('access-control-max-age', String(MAX_AGE_SECONDS));
      return new Response(null, { status: 204, headers });
    }
    const origin = request.headers.get('origin');
    if (origin !== null && allowedOrigins.includes(origin)) {
      headers.set('access-control-allow-origin', origin);
      headers.set('access-control-allow-methods', ALLOWED_METHODS);
      headers.set('access-control-allow-headers', ALLOWED_HEADERS);
      headers.set('access-control-max-age', String(MAX_AGE_SECONDS));
      headers.set('vary', 'Origin');
    }
    return new Response(null, { status: 204, headers });
  }

  public static withCorsHeaders(
    response: Response,
    request: Request,
    allowedOrigins: readonly string[]
  ): Response {
    if (Cors.isWildcard(allowedOrigins)) {
      const headers = new Headers(response.headers);
      headers.set('access-control-allow-origin', '*');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    const origin = request.headers.get('origin');
    if (origin === null || !allowedOrigins.includes(origin)) {
      return response;
    }
    const headers = new Headers(response.headers);
    headers.set('access-control-allow-origin', origin);
    const existingVary = headers.get('vary');
    headers.set('vary', existingVary === null ? 'Origin' : `${existingVary}, Origin`);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  private static isWildcard(allowedOrigins: readonly string[]): boolean {
    return allowedOrigins.length === 1 && allowedOrigins[0] === '*';
  }
}
