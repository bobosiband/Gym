/**
 * Utility for building JSON HTTP responses.
 *
 * Stateless; use via static methods. The private constructor prevents
 * accidental instantiation.
 */
export class JsonResponder {
  private constructor() {
    // utility class; never instantiated
  }

  /**
   * Build a JSON response with the given status and body.
   *
   * @param status - HTTP status code.
   * @param body - Any JSON-serialisable value.
   * @param headers - Optional additional headers merged into the response.
   */
  public static respond(status: number, body: unknown, headers?: HeadersInit): Response {
    const payload = JSON.stringify(body);
    return new Response(payload, {
      status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        ...headers,
      },
    });
  }

  /**
   * Build a JSON response with a public Cache-Control header.
   *
   * Catalogue payloads are read-only reference data, so a modest shared
   * cache keeps the request volume well inside the Worker and D1 free
   * tiers while still allowing seed refreshes to propagate within a few
   * minutes.
   *
   * @param status - HTTP status code.
   * @param body - Any JSON-serialisable value.
   * @param maxAgeSeconds - the cache lifetime served to clients and
   *   intermediate caches.
   * @param headers - Optional additional headers merged into the response.
   */
  public static respondCached(
    status: number,
    body: unknown,
    maxAgeSeconds: number,
    headers?: HeadersInit
  ): Response {
    const cacheHeaders: Record<string, string> = {
      'cache-control': `public, max-age=${maxAgeSeconds}`,
    };
    return JsonResponder.respond(status, body, { ...cacheHeaders, ...headers });
  }
}
