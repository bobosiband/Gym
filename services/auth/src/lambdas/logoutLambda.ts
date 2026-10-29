import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { LogoutHandler } from '../handlers/LogoutHandler.js';
import { LambdaRuntime } from './LambdaRuntime.js';

/**
 * Lambda entry for `POST /auth/logout`.
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  return LambdaRuntime.handleHttp(event, async (runtime) => {
    return new LogoutHandler(runtime.service).handle(event);
  });
}
