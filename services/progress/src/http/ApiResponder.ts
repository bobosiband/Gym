import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

/**
 * Utility for building API Gateway v2 HTTP responses. Mirrors the
 * shape used by `services/logging` so error envelopes and content
 * negotiation are consistent across every Lambda in the project.
 */
export class ApiResponder {
  private constructor() {
    // utility class; never instantiated
  }

  public static respond(
    statusCode: number,
    body: unknown,
    headers: Record<string, string> = {}
  ): APIGatewayProxyStructuredResultV2 {
    return {
      statusCode,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        ...headers,
      },
      body: JSON.stringify(body),
    };
  }
}
