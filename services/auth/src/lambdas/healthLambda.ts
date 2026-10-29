import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { HealthHandler } from '../handlers/HealthHandler.js';

/**
 * Lambda entry for `GET /health`.
 *
 * Deliberately does not use `LambdaRuntime.handleHttp`: the whole
 * point of a health probe is that it responds even when SSM, DynamoDB,
 * SMTP, or the JWT key import are not reachable, so the handler
 * builds the response directly without triggering a cold-start
 * dependency graph.
 */
export async function handler(
  _event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  return HealthHandler.handle();
}
