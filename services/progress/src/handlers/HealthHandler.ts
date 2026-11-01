import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ApiResponder } from '../http/ApiResponder.js';

/**
 * `GET /health` handler. Dependency-free so uptime checks keep
 * working during an SSM or DynamoDB outage.
 */
export class HealthHandler {
  private constructor() {
    // utility class; never instantiated
  }

  public static handle(): APIGatewayProxyStructuredResultV2 {
    return ApiResponder.respond(200, { status: 'ok' });
  }
}
