import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { VerifyEmailHandler } from '../handlers/VerifyEmailHandler.js';
import { LambdaRuntime } from './LambdaRuntime.js';

/**
 * Lambda entry for `POST /auth/verify-email`.
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  return LambdaRuntime.handleHttp(event, async (runtime) => {
    return new VerifyEmailHandler(runtime.service).handle(event);
  });
}
