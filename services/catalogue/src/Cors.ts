const MAX_AGE_SECONDS = 600;

/**
 * CORS helper. Parses the ALLOWED_ORIGINS env var, answers preflight
 * requests, and tags cross-origin responses with the Access-Control
 * headers. Stateless; use via static methods.
 */
export class Cors {
  private constructor() {
    // utility class; never instantiated
  }

  /**
   * Parse the comma-separated ALLOWED_ORIGINS env var.
   * Trims entries and drops empties. Returns an empty list when unset.
   */
  public static parseAllowedOrigins(raw: string | undefined): readonly string[] {
    if (raw === undefined || raw.length === 0) return [];
    return raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  /**
   * Build the OPTIONS preflight response for a cross-origin request.
   * If the request's Origin is on the allow list, returns a 204 with the
   * matching CORS headers. Otherwise returns a 204 with no CORS headers,
   * which the browser treats as a failed preflight.
   */
  public static preflightResponse(request: Request, allowedOrigins: readonly string[]): Response {
    const origin = request.headers.get('origin');
    const headers = new Headers();
    if (origin !== null && allowedOrigins.includes(origin)) {
      headers.set('access-control-allow-origin', origin);
      headers.set('access-control-allow-methods', 'GET, OPTIONS');
      headers.set('access-control-allow-headers', 'content-type');
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
}
