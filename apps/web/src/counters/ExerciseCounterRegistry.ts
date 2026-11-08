import type { LazyExoticComponent } from 'react';

import type { ExerciseCounterComponent } from './ExerciseCounterComponent.js';

type RegisteredCounter = LazyExoticComponent<ExerciseCounterComponent>;

/**
 * Maps a registered exercise kind to the React.lazy component that
 * renders its on-device counter.
 *
 * The registry is the open/closed seam for new exercises. A future
 * `SquatExerciseCounter.tsx` adds itself here; nothing in
 * {@link LogWorkoutScreen} has to know about squats specifically.
 * Codesplit boundaries matter: each counter owns its MediaPipe
 * imports so the base bundle never pays for inference code on
 * screens that do not need it.
 */
export class ExerciseCounterRegistry {
  private readonly byKind: Map<string, RegisteredCounter> = new Map();

  /**
   * Install a counter for an exercise kind. Later calls overwrite so
   * tests can shadow a default for a single assertion.
   */
  public register(kind: string, counter: RegisteredCounter): void {
    this.byKind.set(kind, counter);
  }

  /** Does the registry carry a counter for this exercise? */
  public has(kind: string): boolean {
    return this.byKind.has(kind);
  }

  /** Return the counter for the kind, or `null` if none is registered. */
  public get(kind: string): RegisteredCounter | null {
    return this.byKind.get(kind) ?? null;
  }
}
