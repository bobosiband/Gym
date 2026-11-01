import { LoggingApi } from '@gym/contracts';
import type { z } from 'zod';

/**
 * Zod schemas used by the logging handlers.
 *
 * These delegate to the schemas exported from
 * `@gym/contracts/api/logging`, keeping the HTTP shape and the
 * runtime validation in lock-step. Handlers call these static
 * methods so the live schema object is reused across invocations.
 */
export class HandlerSchemas {
  private constructor() {
    // utility class; never instantiated
  }

  public static logWorkout(): z.ZodType<LoggingApi.LogWorkoutRequest> {
    return LoggingApi.logWorkoutRequestSchema;
  }

  public static listWorkoutsQuery(): z.ZodType<LoggingApi.ListWorkoutsQuery> {
    return LoggingApi.listWorkoutsQuerySchema;
  }
}
