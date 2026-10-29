import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { EnvReader } from '../Env.js';
import { ApiErrors } from '../http/ApiErrors.js';
import { Cors } from '../http/Cors.js';
import { AuthServiceFactory, type AuthRuntime } from '../service/AuthServiceFactory.js';

/**
 * Caches the `AuthRuntime` for the life of the Lambda instance.
 *
 * Each Lambda entry file imports `withRuntime` and passes a callback
 * that returns the response. The runtime is built lazily on the first
 * invocation of a cold start; warm invocations skip the SSM read and
 * key parsing entirely.
 */
export class LambdaRuntime {
  private static cached: Promise<AuthRuntime> | null = null;

  private constructor() {
    // utility class; never instantiated
  }

  /** Shared cold-start resolution. */
  public static getRuntime(): Promise<AuthRuntime> {
    if (LambdaRuntime.cached === null) {
      const env = EnvReader.readFromProcess();
      LambdaRuntime.cached = AuthServiceFactory.build(env);
    }
    return LambdaRuntime.cached;
  }

  /**
   * Common wrapper for every POST handler: handles CORS preflight,
   * invokes `fn` with the resolved runtime, applies CORS to the
   * response, and converts uncaught errors into a 500.
   */
  public static async handleHttp(
    event: APIGatewayProxyEventV2,
    fn: (runtime: AuthRuntime) => Promise<APIGatewayProxyStructuredResultV2>
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
          service: 'auth',
          message: 'unhandled error',
          requestId: event.requestContext.requestId,
          error: err instanceof Error ? err.message : 'unknown',
        })
      );
      return ApiErrors.internal();
    }
  }
}
