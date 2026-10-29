import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ForgotPasswordHandler } from '../handlers/ForgotPasswordHandler.js';
import { LambdaRuntime } from './LambdaRuntime.js';

/**
 * Lambda entry for `POST /auth/forgot-password`.
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  return LambdaRuntime.handleHttp(event, async (runtime) => {
    return new ForgotPasswordHandler(runtime.service).handle(event);
  });
}
