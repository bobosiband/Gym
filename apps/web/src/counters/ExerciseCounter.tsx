import { Suspense } from 'react';

import type { ExerciseCounterProps } from './ExerciseCounterComponent.js';
import type { ExerciseCounterRegistry } from './ExerciseCounterRegistry.js';

/**
 * Props for {@link ExerciseCounter}.
 *
 * `exerciseKind` must be a registered exercise id. The registry
 * resolves the kind to a lazily-loaded component so pulling MediaPipe
 * in only happens when the user actually opens a camera-counted
 * exercise.
 */
export interface ExerciseCounterHostProps extends ExerciseCounterProps {
  readonly exerciseKind: string;
  readonly registry: ExerciseCounterRegistry;
}

/**
 * Generic host for an on-device exercise counter.
 *
 * Looks up the registered React.lazy component for the supplied
 * exercise kind and renders it inside a {@link Suspense} fallback.
 * Unknown kinds render a plain-language notice so a misconfigured
 * exercise is visible to the user and the developer.
 *
 * The host screen never imports a specific counter directly: Task 3
 * adds `pushup`, and Task 5 (squats, lunges, planks) is a pure
 * registry addition.
 */
export function ExerciseCounter(props: ExerciseCounterHostProps): JSX.Element {
  const { exerciseKind, registry, ...counterProps } = props;
  const Component = registry.get(exerciseKind);
  if (Component === null) {
    return (
      <p role="alert" className="form-error">
        No on-device counter is registered for {exerciseKind}.
      </p>
    );
  }
  return (
    <Suspense fallback={<p role="status">Loading counter...</p>}>
      <Component {...counterProps} />
    </Suspense>
  );
}
