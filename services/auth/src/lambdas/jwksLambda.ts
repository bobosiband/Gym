import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { JwksHandler } from '../handlers/JwksHandler.js';
import { LambdaRuntime } from './LambdaRuntime.js';

/**
 * Lambda entry for `GET /.well-known/jwks.json`. The response is
 * public (no authorizer) because every API Gateway in the system
 * needs to fetch the document to verify tokens.
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  return LambdaRuntime.handleHttp(event, async (runtime) => {
    return new JwksHandler(runtime.jwtSigner.getPublicKey(), runtime.env.JWT_KEY_ID).handle();
  });
}
