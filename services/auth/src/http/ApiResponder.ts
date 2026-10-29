import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

/**
 * Builds API Gateway v2 proxy responses.
 *
 * Stateless; use via static methods. The private constructor prevents
 * accidental instantiation. CORS and security headers are applied by
 * the `Cors` helper after the response leaves this class so handler
 * code only ever deals with the business status and body.
 */
export class ApiResponder {
  private constructor() {
    // utility class; never instantiated
  }

  /**
   * Build a JSON response with the given status and body. The body is
   * serialised to JSON here so handlers can pass plain objects.
   */
  public static respond(
    statusCode: number,
    body: unknown,
    headers: Readonly<Record<string, string>> = {}
  ): APIGatewayProxyStructuredResultV2 {
    return {
      statusCode,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        ...headers,
      },
      body: JSON.stringify(body),
    };
  }

  /** Build a 204 No Content response, used for CORS preflight only. */
  public static noContent(
    headers: Readonly<Record<string, string>> = {}
  ): APIGatewayProxyStructuredResultV2 {
    return { statusCode: 204, headers };
  }
}
