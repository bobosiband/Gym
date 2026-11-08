import { UnknownExerciseError } from '@gym/exercise-core';
import { workoutLoggedV1Schema } from '@gym/contracts/events/workoutLogged.v1';
import type { EventBridgeEvent } from 'aws-lambda';

import type { ProgressService } from '../progress/ProgressService.js';

/**
 * EventBridge consumer for `workout.logged.v1`.
 *
 * The handler is invoked by Lambda with the raw EventBridge envelope.
 * It parses the `detail` field through the Zod schema in
 * `@gym/contracts/events/workoutLogged.v1` and delegates to the
 * service, which handles idempotency and state updates internally.
 *
 * The consumer never throws for a malformed detail or for an event
 * whose `kind` is not registered: both are logged and swallowed so
 * EventBridge does not retry a poison message indefinitely. For
 * transient Dynamo/EventBridge errors the service's own exception
 * propagates and triggers a retry.
 */
export class WorkoutLoggedConsumer {
  public constructor(private readonly service: ProgressService) {}

  public async handle(event: EventBridgeEvent<string, unknown>): Promise<void> {
    const parsed = workoutLoggedV1Schema.safeParse(event.detail);
    if (!parsed.success) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          service: 'progress.workoutLogged',
          message: 'invalid event payload',
          issues: parsed.error.issues.map((issue) => issue.message),
        })
      );
      return;
    }
    try {
      await this.service.handleWorkoutLogged(parsed.data);
    } catch (err) {
      if (err instanceof UnknownExerciseError) {
        console.warn(
          JSON.stringify({
            level: 'warn',
            service: 'progress.workoutLogged',
            message: 'unknown exercise id',
            exerciseId: err.exerciseId,
          })
        );
        return;
      }
      throw err;
    }
  }
}
