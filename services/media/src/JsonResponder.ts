/**
 * Utility for building JSON HTTP responses. Mirrors the shape of
 * `services/catalogue/src/JsonResponder.ts` so error envelopes are
 * consistent across the two Workers. Stateless; use via static
 * methods.
 */
export class JsonResponder {
  private constructor() {
    // utility class; never instantiated
  }

  /**
   * Build a JSON response with the given status and body.
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
}
