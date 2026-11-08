import type { ExerciseRegistry } from '@gym/exercise-core';
import type { LoggingApi } from '@gym/contracts';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ApiErrors } from '../http/ApiErrors.js';
import { ApiResponder } from '../http/ApiResponder.js';
import type { LoggingService } from '../service/LoggingService.js';
import { LoggingServiceError } from '../service/LoggingServiceErrors.js';
import type { JwtVerifier } from '../tokens/JwtVerifier.js';
import { HandlerBase } from './HandlerBase.js';
import { HandlerSchemas } from './HandlerSchemas.js';

/**
 * Handles `POST /workouts`.
 *
 * Verifies the Authorization bearer JWT inline using the
 * injected `JwtVerifier` (JWKS-cached across warm invocations),
 * validates the body against the strict Zod schema, honours an
 * optional `Idempotency-Key` header, and delegates to
 * `LoggingService.logWorkout`. The event is published inside the
 * service; this handler translates business errors into HTTP
 * responses and returns `201 { workout }` on success.
 */
export class LogWorkoutHandler {
  public constructor(
    private readonly service: LoggingService,
    private readonly verifier: JwtVerifier,
    private readonly exercises: ExerciseRegistry
  ) {}

  public async handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const logger = HandlerBase.buildLogger('logging.logWorkout', event);
    const bearer = HandlerBase.readBearerToken(event);
    if (bearer === null) {
      logger.warn('logWorkout called without bearer token');
      return ApiErrors.unauthorized('invalid credentials');
    }
    let userId: string;
    try {
      const claims = await this.verifier.verify(bearer);
      userId = claims.sub;
    } catch {
      logger.warn('logWorkout token verify failed');
      return ApiErrors.unauthorized('invalid credentials');
    }

    const parsed = HandlerBase.parseBodyOrFail(event, HandlerSchemas.logWorkout());
    if (!parsed.ok) return parsed.response;

    if (!this.exercises.has(parsed.value.kind)) {
      logger.warn('logWorkout rejected unknown exercise kind', { kind: parsed.value.kind });
      return ApiErrors.badRequest(`unknown exercise kind: ${parsed.value.kind}`);
    }

    const idempotency = HandlerBase.readIdempotencyKey(event);
    if (idempotency.kind === 'invalid') {
      return ApiErrors.badRequest('invalid Idempotency-Key header');
    }

    try {
      const body: LoggingApi.LogWorkoutResponse = await this.service.logWorkout({
        userId,
        body: parsed.value,
        ...(idempotency.kind === 'present' ? { idempotencyKey: idempotency.value } : {}),
      });
      logger.info('logWorkout ok', { workoutId: body.workout.workoutId });
      return ApiResponder.respond(201, body);
    } catch (err) {
      if (err instanceof LoggingServiceError) {
        logger.warn('logWorkout failed', { code: err.code });
        return HandlerBase.mapLoggingError(err);
      }
      logger.error('logWorkout failed with unexpected error');
      return ApiErrors.internal();
    }
  }
}
