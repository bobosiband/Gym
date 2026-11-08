import type { ExerciseRegistry } from '@gym/exercise-core';
import { DefaultExerciseRegistryFactory } from '@gym/exercise-pushup';

import { LoggingService } from '../../../services/logging/src/service/LoggingService.js';

import { CountingIdGenerator } from './CountingIdGenerator.js';
import { FakeClock } from './FakeClock.js';
import { FakeJwtVerifier } from './FakeJwtVerifier.js';
import { InMemoryIdempotencyRepository } from './InMemoryIdempotencyRepository.js';
import { InMemoryWorkoutRepository } from './InMemoryWorkoutRepository.js';
import { RecordingEventPublisher } from './RecordingEventPublisher.js';

/**
 * Shared issuer and audience strings used in test assertions where
 * a real token is minted; the `FakeJwtVerifier` does not check
 * these but the recorded value matches here for clarity.
 */
export const ISSUER = 'https://auth.gym.test';
export const AUDIENCE = 'gym-api';

/**
 * Bundle of in-memory doubles plus a wired `LoggingService`. Tests
 * destructure what they need and either read state back from the
 * doubles or drive the clock to simulate time passing.
 */
export interface TestHarness {
  readonly service: LoggingService;
  readonly workouts: InMemoryWorkoutRepository;
  readonly idempotency: InMemoryIdempotencyRepository;
  readonly events: RecordingEventPublisher;
  readonly clock: FakeClock;
  readonly ids: CountingIdGenerator;
  readonly verifier: FakeJwtVerifier;
  readonly exercises: ExerciseRegistry;
}

/**
 * Build a fully-wired `LoggingService` with in-memory doubles for
 * every boundary. One harness per test; no state leaks.
 */
export function buildLoggingService(): TestHarness {
  const workouts = new InMemoryWorkoutRepository();
  const idempotency = new InMemoryIdempotencyRepository();
  const events = new RecordingEventPublisher();
  const clock = new FakeClock();
  const ids = new CountingIdGenerator();
  const verifier = new FakeJwtVerifier();
  const exercises = DefaultExerciseRegistryFactory.create();

  const service = new LoggingService({ workouts, idempotency, events, clock, ids });

  return { service, workouts, idempotency, events, clock, ids, verifier, exercises };
}
