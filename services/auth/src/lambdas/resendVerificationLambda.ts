import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ResendVerificationHandler } from '../handlers/ResendVerificationHandler.js';
import { LambdaRuntime } from './LambdaRuntime.js';

/**
 * Lambda entry for `POST /auth/resend-verification`.
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  return LambdaRuntime.handleHttp(event, async (runtime) => {
    return new ResendVerificationHandler(runtime.service).handle(event);
  });
}
