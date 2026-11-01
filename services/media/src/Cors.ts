const MAX_AGE_SECONDS = 600;

/**
 * CORS helper. Parses the `ALLOWED_ORIGINS` env var, answers preflight
 * requests, and tags cross-origin responses with the Access-Control
 * headers. Mirrors the catalogue service's helper so cross-origin
 * behaviour is consistent across every Cloudflare Worker in the
 * project.
 */
export class Cors {
  private constructor() {
    // utility class; never instantiated
  }

  /** Parse the comma-separated `ALLOWED_ORIGINS` env var. */
  public static parseAllowedOrigins(raw: string | undefined): readonly string[] {
    if (raw === undefined || raw.length === 0) {
      return [];
    }
    return raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  /**
   * Build the OPTIONS preflight response. Returns a 204 with CORS
   * headers when the request's Origin is on the allow list, and a
   * bare 204 otherwise (the browser treats that as a failed
   * preflight).
   */
  public static preflightResponse(request: Request, allowedOrigins: readonly string[]): Response {
    const headers = new Headers();
    if (Cors.isWildcard(allowedOrigins)) {
      headers.set('access-control-allow-origin', '*');
      headers.set('access-control-allow-methods', 'GET, HEAD, OPTIONS');
      headers.set('access-control-allow-headers', 'content-type, range');
      headers.set('access-control-expose-headers', 'content-length, content-type, etag');
      headers.set('access-control-max-age', String(MAX_AGE_SECONDS));
      return new Response(null, { status: 204, headers });
    }
    const origin = request.headers.get('origin');
    if (origin !== null && allowedOrigins.includes(origin)) {
      headers.set('access-control-allow-origin', origin);
      headers.set('access-control-allow-methods', 'GET, HEAD, OPTIONS');
      headers.set('access-control-allow-headers', 'content-type, range');
      headers.set('access-control-expose-headers', 'content-length, content-type, etag');
      headers.set('access-control-max-age', String(MAX_AGE_SECONDS));
      headers.set('vary', 'Origin');
    }
    return new Response(null, { status: 204, headers });
  }

  /**
   * Add CORS headers to a response if the request's Origin is on the
   * allow list. Clones the response so the original is not mutated.
   */
  public static withCorsHeaders(
    response: Response,
    request: Request,
    allowedOrigins: readonly string[]
  ): Response {
    if (Cors.isWildcard(allowedOrigins)) {
      const headers = new Headers(response.headers);
      headers.set('access-control-allow-origin', '*');
      headers.set('access-control-expose-headers', 'content-length, content-type, etag');
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
    headers.set('access-control-expose-headers', 'content-length, content-type, etag');
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
