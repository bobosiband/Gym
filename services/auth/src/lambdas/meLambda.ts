import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { MeHandler } from '../handlers/MeHandler.js';
import { LambdaRuntime } from './LambdaRuntime.js';

/**
 * Lambda entry for `GET /auth/me`. The handler verifies the JWT
 * inline using the service's own signer; API Gateway v2's built-in
 * JWT authorizer is not used because it requires an OIDC discovery
 * document on the issuer URL, which would force a two-phase deploy.
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  return LambdaRuntime.handleHttp(event, async (runtime) => {
    return new MeHandler(
      runtime.service,
      runtime.jwtSigner,
      runtime.env.JWT_ISSUER,
      runtime.env.JWT_AUDIENCE
    ).handle(event);
  });
}
