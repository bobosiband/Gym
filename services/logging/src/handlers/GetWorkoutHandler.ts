import type { LoggingApi } from '@gym/contracts';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ApiErrors } from '../http/ApiErrors.js';
import { ApiResponder } from '../http/ApiResponder.js';
import type { LoggingService } from '../service/LoggingService.js';
import { LoggingServiceError } from '../service/LoggingServiceErrors.js';
import type { JwtVerifier } from '../tokens/JwtVerifier.js';
import { HandlerBase } from './HandlerBase.js';

/**
 * Handles `GET /workouts/{workoutId}`.
 *
 * Verifies the Bearer JWT, then fetches the workout via the GSI
 * on `workoutId`. Returns 404 for both "no such workout" and
 * "that workout belongs to someone else" so an attacker cannot
 * enumerate ids that exist but are foreign.
 */
export class GetWorkoutHandler {
  public constructor(
    private readonly service: LoggingService,
    private readonly verifier: JwtVerifier
  ) {}

  public async handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const logger = HandlerBase.buildLogger('logging.getWorkout', event);
    const bearer = HandlerBase.readBearerToken(event);
    if (bearer === null) {
      logger.warn('getWorkout called without bearer token');
      return ApiErrors.unauthorized('invalid credentials');
    }
    let userId: string;
    try {
      const claims = await this.verifier.verify(bearer);
      userId = claims.sub;
    } catch {
      logger.warn('getWorkout token verify failed');
      return ApiErrors.unauthorized('invalid credentials');
    }

    const workoutId = event.pathParameters?.['workoutId'];
    if (workoutId === undefined || workoutId.length === 0) {
      return ApiErrors.badRequest('workoutId is required');
    }

    try {
      const workout = await this.service.getWorkout(userId, workoutId);
      const body: LoggingApi.GetWorkoutResponse = { workout };
      return ApiResponder.respond(200, body);
    } catch (err) {
      if (err instanceof LoggingServiceError) {
        logger.warn('getWorkout failed', { code: err.code });
        return HandlerBase.mapLoggingError(err);
      }
      logger.error('getWorkout failed with unexpected error');
      return ApiErrors.internal();
    }
  }
}
