import type { ComponentType } from 'react';

/**
 * Props every on-device exercise counter receives.
 *
 * The widget owns the camera and the rep counter; the host screen
 * only sees completion or an error. Keeping the surface this narrow
 * means {@link LogWorkoutScreen} can treat every registered exercise
 * uniformly and swap in squats or lunges later without any new
 * screen-level branching.
 */
export interface ExerciseCounterProps {
  readonly onComplete: (reps: number) => void;
  readonly onCancel?: () => void;
  readonly onError?: (error: unknown) => void;
}

/**
 * Component type for an on-device exercise counter. Code-split via
 * `React.lazy` in {@link ExerciseCounterRegistry} so the MediaPipe
 * WASM only downloads when a user opens its counter.
 */
export type ExerciseCounterComponent = ComponentType<ExerciseCounterProps>;
