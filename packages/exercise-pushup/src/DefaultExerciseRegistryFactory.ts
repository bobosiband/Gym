import { ExerciseRegistry, SetExercise } from '@gym/exercise-core';

import { PushupExercise } from './PushupExercise.js';

/**
 * Factory that builds the default {@link ExerciseRegistry} shipped
 * with every service and every app.
 *
 * Lives in `@gym/exercise-pushup` because the push-up strategy is
 * the only non-core exercise today. When a new exercise ships, the
 * factory moves to its own package (for example
 * `@gym/exercise-defaults`) and depends on each exercise package;
 * no caller of `create()` is touched.
 */
export class DefaultExerciseRegistryFactory {
  private constructor() {
    // utility class; never instantiated.
  }

  public static create(): ExerciseRegistry {
    const registry = new ExerciseRegistry();
    registry.register(new SetExercise());
    registry.register(new PushupExercise());
    return registry;
  }
}
