import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

import { SetTimeZoneHandler } from '../handlers/SetTimeZoneHandler.js';
import { LambdaRuntime } from './LambdaRuntime.js';

export const handler: APIGatewayProxyHandlerV2 = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  return LambdaRuntime.handleHttp(event, async (runtime) => {
    const next = new SetTimeZoneHandler(runtime.service, runtime.verifier);
    return next.handle(event);
  });
};
