import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { EnvReader } from '../Env.js';
import { ApiErrors } from '../http/ApiErrors.js';
import { Cors } from '../http/Cors.js';
import { ProgressRuntimeFactory, type ProgressRuntime } from '../service/ProgressRuntimeFactory.js';

/**
 * Caches the {@link ProgressRuntime} across warm invocations.
 */
export class LambdaRuntime {
  private static cached: Promise<ProgressRuntime> | null = null;

  private constructor() {
    // utility class; never instantiated
  }

  public static getRuntime(): Promise<ProgressRuntime> {
    if (LambdaRuntime.cached === null) {
      const env = EnvReader.readFromProcess();
      LambdaRuntime.cached = ProgressRuntimeFactory.build(env);
    }
    return LambdaRuntime.cached;
  }

  public static async handleHttp(
    event: APIGatewayProxyEventV2,
    fn: (runtime: ProgressRuntime) => Promise<APIGatewayProxyStructuredResultV2>
  ): Promise<APIGatewayProxyStructuredResultV2> {
    try {
      const runtime = await LambdaRuntime.getRuntime();
      const allowedOrigins = runtime.config.allowedOrigins;
      if (event.requestContext.http.method === 'OPTIONS') {
        return Cors.preflightResponse(event, allowedOrigins);
      }
      const response = await fn(runtime);
      return Cors.withCorsHeaders(response, event, allowedOrigins);
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'progress',
          message: 'unhandled error',
          requestId: event.requestContext.requestId,
          error: err instanceof Error ? err.message : 'unknown',
        })
      );
      return ApiErrors.internal();
    }
  }
}
