import { lazy } from 'react';

import { ExerciseCounterRegistry } from './ExerciseCounterRegistry.js';

/**
 * Builds the default {@link ExerciseCounterRegistry} the shell wires
 * up at startup. Push-ups are the only on-device counter today;
 * adding squats or lunges is one `register` call here. The
 * underlying components use `React.lazy` so each exercise's
 * MediaPipe code only downloads when the user opens its counter.
 */
export class DefaultExerciseCounterRegistryFactory {
  private constructor() {
    // utility class; never instantiated
  }

  public static create(): ExerciseCounterRegistry {
    const registry = new ExerciseCounterRegistry();
    registry.register(
      'pushup',
      lazy(() => import('./PushupExerciseCounter.js'))
    );
    return registry;
  }
}
