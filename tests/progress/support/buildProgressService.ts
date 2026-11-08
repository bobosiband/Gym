import type { ExerciseRegistry } from '@gym/exercise-core';
import { DefaultExerciseRegistryFactory } from '@gym/exercise-pushup';

import { ProgressService } from '../../../services/progress/src/progress/ProgressService.js';
import type { Clock } from '../../../services/progress/src/util/Clock.js';
import type { IdGenerator } from '../../../services/progress/src/util/IdGenerator.js';
import {
  InMemoryProcessedEventRepository,
  InMemoryProgressRepository,
} from './InMemoryProgressRepository.js';
import { RecordingEventPublisher } from './RecordingEventPublisher.js';

/**
 * Deterministic clock backed by a mutable now cursor.
 */
export class StubClock implements Clock {
  public constructor(public current: string) {}

  public nowIso(): string {
    return this.current;
  }

  public nowSeconds(): number {
    return Math.floor(Date.parse(`${this.current}Z`) / 1000);
  }
}

/**
 * Deterministic id generator that returns a sequence
 * `id-1`, `id-2`, ... so test assertions on event ids stay stable.
 */
export class SequentialIdGenerator implements IdGenerator {
  private cursor: number = 0;

  public newId(): string {
    this.cursor += 1;
    return `id-${this.cursor.toString().padStart(2, '0')}`;
  }
}

export interface BuiltProgressService {
  readonly service: ProgressService;
  readonly progress: InMemoryProgressRepository;
  readonly processed: InMemoryProcessedEventRepository;
  readonly events: RecordingEventPublisher;
  readonly clock: StubClock;
  readonly ids: SequentialIdGenerator;
  readonly exercises: ExerciseRegistry;
}

/**
 * Wire a ProgressService with in-memory fakes and deterministic
 * clock + ids. Returns both the service and the fakes so individual
 * tests can seed state or inspect side effects.
 *
 * `exercises` defaults to the production registry; tests that need
 * to shadow an exercise (or register a test-only one) pass in their
 * own instance.
 */
export function buildProgressService(
  opts: {
    now?: string;
    exercises?: ExerciseRegistry;
  } = {}
): BuiltProgressService {
  const progress = new InMemoryProgressRepository();
  const processed = new InMemoryProcessedEventRepository();
  const events = new RecordingEventPublisher();
  const clock = new StubClock(opts.now ?? '2026-11-02T00:00:00');
  const ids = new SequentialIdGenerator();
  const exercises = opts.exercises ?? DefaultExerciseRegistryFactory.create();
  const service = new ProgressService({
    progress,
    processed,
    events,
    clock,
    ids,
    exercises,
  });
  return { service, progress, processed, events, clock, ids, exercises };
}
