import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

import { SetDailyTargetHandler } from '../handlers/SetDailyTargetHandler.js';
import { LambdaRuntime } from './LambdaRuntime.js';

export const handler: APIGatewayProxyHandlerV2 = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  return LambdaRuntime.handleHttp(event, async (runtime) => {
    const next = new SetDailyTargetHandler(runtime.service, runtime.verifier);
    return next.handle(event);
  });
};
