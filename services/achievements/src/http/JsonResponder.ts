/**
 * Centralised JSON response builder. Guarantees the `content-type`
 * header is always set so middleware (CORS wrapper) does not have
 * to reach into the body shape.
 */
export class JsonResponder {
  private constructor() {
    // utility class; never instantiated
  }

  public static respond(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    });
  }
}
