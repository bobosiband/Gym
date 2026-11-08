/**
 * Public entry point for `@gym/pushup-counter`.
 *
 * Re-exports pose primitives from `@gym/pose` and the push-up
 * strategy from `@gym/exercise-pushup` alongside the React widget
 * used by the deployed PWA shell. The thin {@link PushupRepCounter}
 * facade is retained so Stage 2 tests keep working.
 */

export { PoseLandmarkIndex } from '@gym/pose';
export type { PoseLandmark, PoseLandmarks, PoseSource, PoseFrameListener } from '@gym/pose';
export { RepCounter } from '@gym/pose';
export { MediaPipePoseSource } from '@gym/pose/browser';
export type { MediaPipePoseSourceOptions } from '@gym/pose/browser';
export { PushupRepDetector } from '@gym/exercise-pushup';
export type { PushupRepDetectorOptions } from '@gym/exercise-pushup';
export { PushupRepCounter } from './PushupRepCounter.js';
export type { PushupPhase, PushupRepCounterOptions } from './PushupRepCounter.js';
export { PushupCounter } from './PushupCounter.js';
export type { PushupCounterProps } from './PushupCounter.js';
