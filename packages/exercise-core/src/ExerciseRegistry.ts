import type { Exercise } from './Exercise.js';

/**
 * Error thrown when a caller tries to score an event for an
 * exercise id that is not registered. Services catch this at the
 * boundary and return a 400 to the caller.
 */
export class UnknownExerciseError extends Error {
  public constructor(public readonly exerciseId: string) {
    super(`unknown exercise id: ${exerciseId}`);
    this.name = 'UnknownExerciseError';
  }
}

/**
 * Registry mapping stable string ids to {@link Exercise} instances.
 *
 * The registry is deliberately mutable at construction time
 * (`register` is public) so composition roots and tests can install
 * a one-off exercise without editing the shared factory. After
 * construction the registry is treated as read-only by services.
 */
export class ExerciseRegistry {
  private readonly byId: Map<string, Exercise> = new Map();

  /**
   * Install an exercise. Later calls with the same id overwrite the
   * earlier entry; this keeps the registry open/closed for tests
   * that want to shadow a default.
   */
  public register(exercise: Exercise): void {
    this.byId.set(exercise.id, exercise);
  }

  /** Does the registry carry an entry for this id? */
  public has(id: string): boolean {
    return this.byId.has(id);
  }

  /**
   * Fetch an exercise by id. Throws {@link UnknownExerciseError} when
   * the id is not registered so callers do not silently fall through
   * to a default.
   */
  public get(id: string): Exercise {
    const exercise = this.byId.get(id);
    if (exercise === undefined) {
      throw new UnknownExerciseError(id);
    }
    return exercise;
  }

  /** Enumerate the registered exercises. */
  public list(): readonly Exercise[] {
    return Array.from(this.byId.values());
  }
}
