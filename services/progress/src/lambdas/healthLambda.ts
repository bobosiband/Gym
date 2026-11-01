import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

import { HealthHandler } from '../handlers/HealthHandler.js';

/**
 * `GET /health` entry. No bindings, no SSM. Separate Lambda so an
 * SSM or DynamoDB outage does not fail the probe.
 */
export const handler: APIGatewayProxyHandlerV2 = async (
  _event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  return HealthHandler.handle();
};
