import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { MeHandler } from '../handlers/MeHandler.js';
import { LambdaRuntime } from './LambdaRuntime.js';

/**
 * Lambda entry for `GET /auth/me`. The caller's JWT has already been
 * validated by the API Gateway JWT authorizer by the time this fires.
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  return LambdaRuntime.handleHttp(event, async (runtime) => {
    return new MeHandler(runtime.service).handle(event);
  });
}
