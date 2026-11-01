import type { LoggingApi } from '@gym/contracts';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ApiErrors } from '../http/ApiErrors.js';
import { ApiResponder } from '../http/ApiResponder.js';
import type { LoggingService } from '../service/LoggingService.js';
import { LoggingServiceError } from '../service/LoggingServiceErrors.js';
import type { JwtVerifier } from '../tokens/JwtVerifier.js';
import type { ListWorkoutsOptions } from '../workouts/WorkoutRepository.js';
import { HandlerBase } from './HandlerBase.js';
import { HandlerSchemas } from './HandlerSchemas.js';

/**
 * Handles `GET /workouts`.
 *
 * Verifies the Bearer JWT, validates the query string against
 * the strict Zod schema, and returns the caller's own workouts
 * newest first. `limit` defaults to 20 when not supplied; the
 * repository clamps nothing further because the schema already
 * caps it at 100.
 */
export class ListWorkoutsHandler {
  private static readonly DEFAULT_LIMIT = 20;

  public constructor(
    private readonly service: LoggingService,
    private readonly verifier: JwtVerifier
  ) {}

  public async handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const logger = HandlerBase.buildLogger('logging.listWorkouts', event);
    const bearer = HandlerBase.readBearerToken(event);
    if (bearer === null) {
      logger.warn('listWorkouts called without bearer token');
      return ApiErrors.unauthorized('invalid credentials');
    }
    let userId: string;
    try {
      const claims = await this.verifier.verify(bearer);
      userId = claims.sub;
    } catch {
      logger.warn('listWorkouts token verify failed');
      return ApiErrors.unauthorized('invalid credentials');
    }

    const schema = HandlerSchemas.listWorkoutsQuery();
    const parsed = schema.safeParse(event.queryStringParameters ?? {});
    if (!parsed.success) {
      return ApiErrors.badRequest('invalid query string');
    }
    const options: ListWorkoutsOptions = {
      limit: parsed.data.limit ?? ListWorkoutsHandler.DEFAULT_LIMIT,
      ...(parsed.data.from === undefined ? {} : { from: parsed.data.from }),
      ...(parsed.data.to === undefined ? {} : { to: parsed.data.to }),
      ...(parsed.data.cursor === undefined ? {} : { cursor: parsed.data.cursor }),
    };

    try {
      const page = await this.service.listWorkouts(userId, options);
      const body: LoggingApi.ListWorkoutsResponse = {
        workouts: [...page.workouts],
        ...(page.cursor === undefined ? {} : { cursor: page.cursor }),
      };
      return ApiResponder.respond(200, body);
    } catch (err) {
      if (err instanceof LoggingServiceError) {
        logger.warn('listWorkouts failed', { code: err.code });
        return HandlerBase.mapLoggingError(err);
      }
      logger.error('listWorkouts failed with unexpected error');
      return ApiErrors.internal();
    }
  }
}
