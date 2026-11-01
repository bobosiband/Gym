import type { EventBridgeEvent } from 'aws-lambda';

import { EnvReader } from '../Env.js';
import { WorkoutLoggedConsumer } from '../handlers/WorkoutLoggedConsumer.js';
import { ProgressRuntimeFactory, type ProgressRuntime } from '../service/ProgressRuntimeFactory.js';

let runtime: Promise<ProgressRuntime> | null = null;

/**
 * EventBridge consumer entry. Receives `workout.logged.v1` events,
 * dedupes them per eventId inside the service, and updates the
 * user's progress state.
 *
 * The runtime cache is maintained inside this file (rather than
 * through `LambdaRuntime`) because the HTTP wrapper is irrelevant
 * for an event handler.
 */
export const handler = async (event: EventBridgeEvent<string, unknown>): Promise<void> => {
  if (runtime === null) {
    runtime = ProgressRuntimeFactory.build(EnvReader.readFromProcess());
  }
  const resolved = await runtime;
  const consumer = new WorkoutLoggedConsumer(resolved.service);
  await consumer.handle(event);
};
