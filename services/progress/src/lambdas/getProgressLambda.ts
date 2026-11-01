import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

import { GetProgressHandler } from '../handlers/GetProgressHandler.js';
import { LambdaRuntime } from './LambdaRuntime.js';

export const handler: APIGatewayProxyHandlerV2 = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  return LambdaRuntime.handleHttp(event, async (runtime) => {
    const next = new GetProgressHandler(runtime.service, runtime.verifier);
    return next.handle(event);
  });
};
