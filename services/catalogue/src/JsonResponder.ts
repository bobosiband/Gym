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
}
